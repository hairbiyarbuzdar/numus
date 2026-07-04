import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { OrderRecord, useOrders } from "./OrdersContext";
import { logisticsService } from "../services/logisticsService";
import { ShipmentMethod, ShipmentRecord, ShipmentStatus } from "../types/logistics";

interface QrResolveResult {
  shipment: ShipmentRecord | null;
  message: string;
}

interface LogisticsContextType {
  shipments: ShipmentRecord[];
  orders: OrderRecord[];
  createShipmentFromOrder: (orderId: string, method: ShipmentMethod) => QrResolveResult;
  resolveQrCode: (payload: string, method: ShipmentMethod) => QrResolveResult;
  updateShipmentStatus: (
    shipmentId: string,
    payload: { status: ShipmentStatus; location?: string; note?: string }
  ) => QrResolveResult;
  assignCourierService: (shipmentId: string, courierService: string) => QrResolveResult;
}

const LogisticsContext = createContext<LogisticsContextType | undefined>(undefined);

const ADMIN_ACTOR = "superAdmin";

export const LogisticsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { orders } = useOrders();
  const [shipments, setShipments] = useState<ShipmentRecord[]>([]);

  useEffect(() => {
    setShipments(logisticsService.getShipments());
  }, []);

  const refreshShipments = () => {
    setShipments(logisticsService.getShipments());
  };

  const createShipmentFromOrder = (orderId: string, method: ShipmentMethod): QrResolveResult => {
    const order = orders.find((item) => item.id === orderId);
    if (!order) return { shipment: null, message: "Order not found." };
    const shipment = logisticsService.ensureShipment(order, method, ADMIN_ACTOR);
    refreshShipments();
    return { shipment, message: "Shipment linked successfully." };
  };

  const resolveQrCode = (payload: string, method: ShipmentMethod): QrResolveResult => {
    const parsed = logisticsService.parseQrPayload(payload);

    if (parsed.shipmentId) {
      const shipment = logisticsService.findShipmentById(parsed.shipmentId);
      if (!shipment) return { shipment: null, message: "Shipment not found for this QR." };
      refreshShipments();
      return { shipment, message: "Shipment found via QR." };
    }

    const orderId = parsed.orderId;
    if (!orderId) return { shipment: null, message: "Invalid QR code payload." };
    return createShipmentFromOrder(orderId, parsed.method ?? method);
  };

  const updateShipmentStatus = (
    shipmentId: string,
    payload: { status: ShipmentStatus; location?: string; note?: string }
  ): QrResolveResult => {
    const shipment = logisticsService.updateStatus(shipmentId, {
      status: payload.status,
      location: payload.location,
      note: payload.note,
      actor: ADMIN_ACTOR,
    });
    if (!shipment) return { shipment: null, message: "Shipment not found." };
    refreshShipments();
    return { shipment, message: "Shipment status updated." };
  };

  const assignCourierService = (shipmentId: string, courierService: string): QrResolveResult => {
    if (!courierService.trim()) return { shipment: null, message: "Courier service is required." };
    const shipment = logisticsService.updateCourierService(shipmentId, courierService, ADMIN_ACTOR);
    if (!shipment) return { shipment: null, message: "Shipment not found." };
    refreshShipments();
    return { shipment, message: "Courier assigned successfully." };
  };

  const value = useMemo(
    () => ({
      shipments,
      orders,
      createShipmentFromOrder,
      resolveQrCode,
      updateShipmentStatus,
      assignCourierService,
    }),
    [orders, shipments]
  );

  return <LogisticsContext.Provider value={value}>{children}</LogisticsContext.Provider>;
};

export const useLogistics = () => {
  const context = useContext(LogisticsContext);
  if (!context) throw new Error("useLogistics must be used within a LogisticsProvider");
  return context;
};
