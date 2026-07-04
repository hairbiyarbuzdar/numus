export type ShipmentMethod = "warehouse" | "courier";

export const WAREHOUSE_STATUS_FLOW = [
  "Order Packed by Farmer",
  "Shipped to Warehouse",
  "Received at Warehouse",
  "Stored in Warehouse",
  "Ready for Dispatch",
  "Out for Delivery",
  "Delivered to Customer",
] as const;

export const COURIER_STATUS_FLOW = [
  "Packed by Farmer",
  "Picked by Courier",
  "In Transit",
  "Reached Destination City",
  "Out for Delivery",
  "Delivered",
] as const;

export type WarehouseShipmentStatus = (typeof WAREHOUSE_STATUS_FLOW)[number];
export type CourierShipmentStatus = (typeof COURIER_STATUS_FLOW)[number];
export type ShipmentStatus = WarehouseShipmentStatus | CourierShipmentStatus;

export interface ShipmentHistoryEntry {
  id: string;
  status: ShipmentStatus;
  location?: string;
  note?: string;
  updatedAt: number;
  updatedBy: string;
}

export interface ShipmentProductLine {
  productId: string;
  title: string;
  qty: number;
  image: string;
}

export interface ShipmentFarmerInfo {
  vendorId: string;
  vendorName: string;
}

export interface ShipmentCustomerInfo {
  customerId: string;
  fullName: string;
  phone: string;
  whatsapp: string;
  email: string;
  city: string;
  fullAddress: string;
}

export interface ShipmentRecord {
  shipmentId: string;
  qrCode: string;
  orderId: string;
  method: ShipmentMethod;
  products: ShipmentProductLine[];
  farmers: ShipmentFarmerInfo[];
  customer: ShipmentCustomerInfo;
  courierService?: string;
  currentStatus: ShipmentStatus;
  currentLocation?: string;
  createdAt: number;
  updatedAt: number;
  history: ShipmentHistoryEntry[];
}
