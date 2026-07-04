export interface OrderItem {
  productId: string;
  title: string;
  price: number;
  qty: number;
  image: string;
  vendorId: string;
  vendorName: string;
}

export interface OrderData {
  userId: string;
  customerInfo: {
    fullName: string;
    phone: string;
    whatsapp: string;
    email: string;
  };
  addressInfo: {
    fullAddress: string;
    city: string;
    postalCode: string;
  };
  items: OrderItem[];
  paymentMethod: 'easypaisa' | 'jazzcash' | 'cod';
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered';
  createdAtISO: string;
}

export const createOrder = async (orderData: OrderData) => {
  try {
    // In a real app with Firebase keys, this would write to Firestore
    // const docRef = await addDoc(collection(db, "orders"), {
    //   ...orderData,
    //   createdAt: serverTimestamp()
    // });
    // return docRef.id;

    // Simulation for demo
    console.log("Creating Order in Firestore:", orderData);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return `ord_${crypto.randomUUID()}`;
    }
    return `ord_${Math.random().toString(36).slice(2, 11)}`;
  } catch (error) {
    console.error("Error creating order:", error);
    throw error;
  }
};
