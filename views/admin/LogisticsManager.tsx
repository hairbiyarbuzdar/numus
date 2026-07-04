import React, { useMemo, useState } from "react";
import { CheckCircle2, QrCode, Search, Truck, Warehouse } from "lucide-react";
import { useLogistics } from "../../context/LogisticsContext";
import {
  COURIER_STATUS_FLOW,
  ShipmentMethod,
  ShipmentRecord,
  ShipmentStatus,
  WAREHOUSE_STATUS_FLOW,
} from "../../types/logistics";

type LogisticsTab = "warehouse" | "courier";

const tabConfig: Record<LogisticsTab, { label: string; method: ShipmentMethod; icon: React.ReactNode }> = {
  warehouse: {
    label: "Warehouse Tracking",
    method: "warehouse",
    icon: <Warehouse className="h-4 w-4" />,
  },
  courier: {
    label: "Shipment Delivery",
    method: "courier",
    icon: <Truck className="h-4 w-4" />,
  },
};

const statusFlowByMethod: Record<ShipmentMethod, readonly ShipmentStatus[]> = {
  warehouse: WAREHOUSE_STATUS_FLOW,
  courier: COURIER_STATUS_FLOW,
};

const LogisticsManager: React.FC = () => {
  const { shipments, orders, resolveQrCode, createShipmentFromOrder, updateShipmentStatus, assignCourierService } = useLogistics();

  const [activeTab, setActiveTab] = useState<LogisticsTab>("warehouse");
  const [query, setQuery] = useState("");
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState<ShipmentStatus>(WAREHOUSE_STATUS_FLOW[0]);
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [courierServiceDraft, setCourierServiceDraft] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const activeMethod = tabConfig[activeTab].method;
  const statusFlow = statusFlowByMethod[activeMethod];

  const filteredShipments = useMemo(() => {
    const term = query.trim().toLowerCase();
    return shipments
      .filter((shipment) => shipment.method === activeMethod)
      .filter((shipment) => {
        if (!term) return true;
        const productText = shipment.products.map((product) => product.title).join(" ");
        const farmersText = shipment.farmers.map((farmer) => farmer.vendorName).join(" ");
        const fullText = [
          shipment.shipmentId,
          shipment.orderId,
          shipment.currentStatus,
          shipment.currentLocation || "",
          shipment.customer.fullName,
          shipment.customer.city,
          shipment.courierService || "",
          productText,
          farmersText,
        ]
          .join(" ")
          .toLowerCase();
        return fullText.includes(term);
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [activeMethod, query, shipments]);

  const matchedOrders = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return orders
      .filter((order) => !shipments.some((shipment) => shipment.orderId === order.id && shipment.method === activeMethod))
      .filter((order) => {
        const fullText = `${order.id} ${order.customerInfo.fullName} ${order.items.map((item) => item.title).join(" ")}`.toLowerCase();
        return fullText.includes(term);
      })
      .slice(0, 6);
  }, [activeMethod, orders, query, shipments]);

  const selectedShipment =
    filteredShipments.find((shipment) => shipment.shipmentId === selectedShipmentId) ||
    shipments.find((shipment) => shipment.shipmentId === selectedShipmentId) ||
    null;

  const handleNotice = (type: "success" | "error", text: string) => setNotice({ type, text });

  const handleScanQr = () => {
    const payload = window.prompt("Scan QR: paste shipment QR content");
    if (!payload) return;
    const result = resolveQrCode(payload, activeMethod);
    if (!result.shipment) {
      handleNotice("error", result.message);
      return;
    }
    setSelectedShipmentId(result.shipment.shipmentId);
    setNextStatus(result.shipment.currentStatus);
    setLocation(result.shipment.currentLocation || "");
    setCourierServiceDraft(result.shipment.courierService || "");
    handleNotice("success", result.message);
  };

  const handleCreateFromOrder = (orderId: string) => {
    const result = createShipmentFromOrder(orderId, activeMethod);
    if (!result.shipment) {
      handleNotice("error", result.message);
      return;
    }
    setSelectedShipmentId(result.shipment.shipmentId);
    setNextStatus(result.shipment.currentStatus);
    setLocation(result.shipment.currentLocation || "");
    setCourierServiceDraft(result.shipment.courierService || "");
    handleNotice("success", result.message);
  };

  const handleStatusUpdate = () => {
    if (!selectedShipment) return;
    const result = updateShipmentStatus(selectedShipment.shipmentId, {
      status: nextStatus,
      location: location.trim() || undefined,
      note: note.trim() || undefined,
    });
    if (!result.shipment) {
      handleNotice("error", result.message);
      return;
    }
    setNote("");
    setLocation(result.shipment.currentLocation || "");
    setNextStatus(result.shipment.currentStatus);
    handleNotice("success", result.message);
  };

  const handleAssignCourier = () => {
    if (!selectedShipment) return;
    const result = assignCourierService(selectedShipment.shipmentId, courierServiceDraft);
    if (!result.shipment) {
      handleNotice("error", result.message);
      return;
    }
    handleNotice("success", result.message);
  };

  const selectedStepIndex = selectedShipment ? statusFlow.indexOf(selectedShipment.currentStatus) : -1;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-cyan-900 to-teal-800 p-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold tracking-tight">Logistics Management</h1>
        <p className="mt-2 text-sm text-cyan-100">
          Track shipment lifecycles, scan shipment QR codes, and maintain warehouse/courier status history.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2 flex flex-wrap gap-2">
            {(Object.keys(tabConfig) as LogisticsTab[]).map((key) => (
              <button
                key={key}
                onClick={() => {
                  setActiveTab(key);
                  setSelectedShipmentId(null);
                  setNotice(null);
                  setNextStatus(statusFlowByMethod[tabConfig[key].method][0]);
                }}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                  activeTab === key ? "bg-emerald-600 text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {tabConfig[key].icon}
                {tabConfig[key].label}
              </button>
            ))}
          </div>
          <button
            onClick={handleScanQr}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800"
          >
            <QrCode className="h-4 w-4" />
            Scan QR
          </button>
        </div>
        <div className="mt-3 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by shipment ID, order ID, customer, farmer, product"
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm"
          />
        </div>
        {notice && (
          <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${notice.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
            {notice.text}
          </p>
        )}
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Shipments</h2>
          <div className="mt-3 space-y-2 max-h-[520px] overflow-y-auto">
            {filteredShipments.map((shipment) => (
              <button
                key={shipment.shipmentId}
                onClick={() => {
                  setSelectedShipmentId(shipment.shipmentId);
                  setNextStatus(shipment.currentStatus);
                  setLocation(shipment.currentLocation || "");
                  setCourierServiceDraft(shipment.courierService || "");
                }}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                  selectedShipmentId === shipment.shipmentId ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <p className="font-semibold text-slate-900">{shipment.shipmentId}</p>
                <p className="text-xs text-slate-500">Order {shipment.orderId}</p>
                <p className="text-xs text-slate-500">{shipment.customer.fullName} | {shipment.customer.city}</p>
                <p className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                  {shipment.currentStatus}
                </p>
              </button>
            ))}
            {filteredShipments.length === 0 && <p className="text-sm text-slate-500">No shipments found for this module.</p>}
          </div>

          {matchedOrders.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Create Shipment From Order</h3>
              <div className="mt-2 space-y-2">
                {matchedOrders.map((order) => (
                  <div key={order.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <p className="font-semibold text-slate-900">{order.id}</p>
                    <p className="text-xs text-slate-500">{order.customerInfo.fullName} | {order.items.length} item(s)</p>
                    <button
                      onClick={() => handleCreateFromOrder(order.id)}
                      className="mt-2 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      Create Shipment
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          {!selectedShipment && <p className="text-sm text-slate-500">Select a shipment to view lifecycle tracking details.</p>}

          {selectedShipment && (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Shipment ID</p>
                  <p className="font-semibold text-slate-900">{selectedShipment.shipmentId}</p>
                  <p className="mt-1 text-xs text-slate-500">Order: {selectedShipment.orderId}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">QR Payload</p>
                  <p className="font-mono text-xs text-slate-700 break-all">{selectedShipment.qrCode}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Customer</p>
                  <p className="font-semibold text-slate-900">{selectedShipment.customer.fullName}</p>
                  <p className="text-sm text-slate-600">{selectedShipment.customer.phone} | {selectedShipment.customer.city}</p>
                  <p className="text-xs text-slate-500">{selectedShipment.customer.fullAddress}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Farmers</p>
                  {selectedShipment.farmers.map((farmer) => (
                    <p key={farmer.vendorId} className="text-sm text-slate-700">{farmer.vendorName}</p>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Products</p>
                <div className="mt-2 space-y-2">
                  {selectedShipment.products.map((product) => (
                    <div key={`${selectedShipment.shipmentId}-${product.productId}`} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">{product.title}</span>
                      <span className="font-semibold text-slate-900">Qty {product.qty}</span>
                    </div>
                  ))}
                </div>
              </div>

              {activeMethod === "courier" && (
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Shipment Service Delivery</p>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={courierServiceDraft}
                      onChange={(event) => setCourierServiceDraft(event.target.value)}
                      placeholder="Assign courier partner (e.g., TCS, Leopard)"
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <button
                      onClick={handleAssignCourier}
                      className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                    >
                      Assign
                    </button>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Update Shipment Status</p>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  <select
                    value={nextStatus}
                    onChange={(event) => setNextStatus(event.target.value as ShipmentStatus)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    {statusFlow.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                  <input
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder="Current location"
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <button
                    onClick={handleStatusUpdate}
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    Update Status
                  </button>
                </div>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={2}
                  placeholder="Optional note for this status update"
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Shipment Timeline</p>
                <div className="mt-2 space-y-2">
                  {statusFlow.map((status, index) => {
                    const isReached = selectedStepIndex >= index;
                    return (
                      <div key={status} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className={`h-4 w-4 ${isReached ? "text-emerald-600" : "text-slate-300"}`} />
                        <span className={isReached ? "text-slate-900 font-semibold" : "text-slate-500"}>{status}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Status History Log</p>
                <div className="mt-2 space-y-2 max-h-56 overflow-y-auto">
                  {selectedShipment.history.map((entry) => (
                    <div key={entry.id} className="rounded-md border border-slate-100 px-3 py-2 text-sm">
                      <p className="font-semibold text-slate-900">{entry.status}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(entry.updatedAt).toLocaleString()} | {entry.updatedBy}
                      </p>
                      {entry.location && <p className="text-xs text-slate-600">Location: {entry.location}</p>}
                      {entry.note && <p className="text-xs text-slate-600">Note: {entry.note}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default LogisticsManager;
