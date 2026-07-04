import { OrderRecord } from "../context/OrdersContext";
import {
  COURIER_STATUS_FLOW,
  ShipmentMethod,
  ShipmentRecord,
  ShipmentStatus,
  WAREHOUSE_STATUS_FLOW,
} from "../types/logistics";
import { readLocalStorage, writeLocalStorage } from "../utils/localStorage";

const SHIPMENTS_STORAGE_KEY = "kissanhub_shipments";

const makeId = (prefix: string) => `${prefix}_${Date.now()}_${Math.floor(Math.random() * 900000 + 100000)}`;

const getDefaultStatus = (method: ShipmentMethod): ShipmentStatus =>
  method === "warehouse" ? WAREHOUSE_STATUS_FLOW[0] : COURIER_STATUS_FLOW[0];

export const getStatusFlow = (method: ShipmentMethod) =>
  method === "warehouse" ? WAREHOUSE_STATUS_FLOW : COURIER_STATUS_FLOW;

export const makeShipmentQrCode = (shipmentId: string, orderId: string, method: ShipmentMethod) =>
  JSON.stringify({ shipmentId, orderId, method });

const toShipmentRecord = (order: OrderRecord, method: ShipmentMethod, createdBy: string): ShipmentRecord => {
  const shipmentId = `SHP-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 900 + 100)}`;
  const status = getDefaultStatus(method);
  const now = Date.now();
  const farmersMap = new Map<string, { vendorId: string; vendorName: string }>();
  order.items.forEach((item) => {
    farmersMap.set(item.vendorId, { vendorId: item.vendorId, vendorName: item.vendorName });
  });

  return {
    shipmentId,
    qrCode: makeShipmentQrCode(shipmentId, order.id, method),
    orderId: order.id,
    method,
    products: order.items.map((item) => ({
      productId: item.productId,
      title: item.title,
      qty: item.qty,
      image: item.image,
    })),
    farmers: Array.from(farmersMap.values()),
    customer: {
      customerId: order.customerId,
      fullName: order.customerInfo.fullName,
      phone: order.customerInfo.phone,
      whatsapp: order.customerInfo.whatsapp,
      email: order.customerInfo.email,
      city: order.addressInfo.city,
      fullAddress: order.addressInfo.fullAddress,
    },
    currentStatus: status,
    currentLocation: order.addressInfo.city,
    createdAt: now,
    updatedAt: now,
    history: [
      {
        id: makeId("hist"),
        status,
        location: order.addressInfo.city,
        note: "Shipment record created",
        updatedAt: now,
        updatedBy: createdBy,
      },
    ],
  };
};

export const logisticsService = {
  getShipments() {
    return readLocalStorage<ShipmentRecord[]>(SHIPMENTS_STORAGE_KEY, []);
  },

  saveShipments(shipments: ShipmentRecord[]) {
    writeLocalStorage(SHIPMENTS_STORAGE_KEY, shipments);
  },

  findShipmentById(shipmentId: string) {
    return this.getShipments().find((shipment) => shipment.shipmentId === shipmentId);
  },

  findShipmentByOrder(orderId: string, method: ShipmentMethod) {
    return this.getShipments().find((shipment) => shipment.orderId === orderId && shipment.method === method);
  },

  ensureShipment(order: OrderRecord, method: ShipmentMethod, actor: string) {
    const shipments = this.getShipments();
    const existing = shipments.find((shipment) => shipment.orderId === order.id && shipment.method === method);
    if (existing) return existing;

    const next = toShipmentRecord(order, method, actor);
    shipments.unshift(next);
    this.saveShipments(shipments);
    return next;
  },

  updateStatus(
    shipmentId: string,
    payload: { status: ShipmentStatus; location?: string; note?: string; actor: string }
  ) {
    let updated: ShipmentRecord | null = null;
    const shipments = this.getShipments().map((shipment) => {
      if (shipment.shipmentId !== shipmentId) return shipment;
      const next: ShipmentRecord = {
        ...shipment,
        currentStatus: payload.status,
        currentLocation: payload.location ?? shipment.currentLocation,
        updatedAt: Date.now(),
        history: [
          {
            id: makeId("hist"),
            status: payload.status,
            location: payload.location ?? shipment.currentLocation,
            note: payload.note,
            updatedAt: Date.now(),
            updatedBy: payload.actor,
          },
          ...shipment.history,
        ],
      };
      updated = next;
      return next;
    });
    this.saveShipments(shipments);
    return updated;
  },

  updateCourierService(shipmentId: string, courierService: string, actor: string) {
    let updated: ShipmentRecord | null = null;
    const shipments = this.getShipments().map((shipment) => {
      if (shipment.shipmentId !== shipmentId) return shipment;
      const next: ShipmentRecord = {
        ...shipment,
        courierService: courierService.trim(),
        updatedAt: Date.now(),
        history: [
          {
            id: makeId("hist"),
            status: shipment.currentStatus,
            location: shipment.currentLocation,
            note: `Courier assigned: ${courierService.trim()}`,
            updatedAt: Date.now(),
            updatedBy: actor,
          },
          ...shipment.history,
        ],
      };
      updated = next;
      return next;
    });
    this.saveShipments(shipments);
    return updated;
  },

  parseQrPayload(payload: string): { shipmentId?: string; orderId?: string; method?: ShipmentMethod } {
    const raw = payload.trim();
    if (!raw) return {};

    try {
      const parsed = JSON.parse(raw) as { shipmentId?: string; orderId?: string; method?: ShipmentMethod };
      return {
        shipmentId: parsed.shipmentId,
        orderId: parsed.orderId,
        method: parsed.method,
      };
    } catch {
      if (raw.startsWith("SHP-")) return { shipmentId: raw };
      if (raw.startsWith("ORD-")) return { orderId: raw };
      return {};
    }
  },
};
