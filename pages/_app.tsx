import type { AppProps } from "next/app";
import { CartProvider } from "../context/CartContext";
import { AuthProvider } from "../context/AuthContext";
import { ProductProvider } from "../context/ProductContext";
import { OrdersProvider } from "../context/OrdersContext";
import { LogisticsProvider } from "../context/LogisticsContext";
import { WishlistProvider } from "../context/WishlistContext";
import { UsersProvider } from "../context/UsersContext";
import { NotificationsProvider } from "../context/NotificationsContext";
import "../styles/globals.css";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <ProductProvider>
        <OrdersProvider>
          <LogisticsProvider>
            <UsersProvider>
              <WishlistProvider>
                <CartProvider>
                  <NotificationsProvider>
                    <Component {...pageProps} />
                  </NotificationsProvider>
                </CartProvider>
              </WishlistProvider>
            </UsersProvider>
          </LogisticsProvider>
        </OrdersProvider>
      </ProductProvider>
    </AuthProvider>
  );
}
