/**
 * Run once to create all tables.
 * Usage: node src/db/migrate.js
 */

require("dotenv").config();
const pool = require("./index");

const schema = `

-- Users
CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(128) PRIMARY KEY,
  phone         VARCHAR(20)  UNIQUE NOT NULL,
  display_name  VARCHAR(255) NOT NULL,
  role          VARCHAR(20)  NOT NULL CHECK (role IN ('superAdmin', 'vendor', 'buyer')),
  user_type     VARCHAR(20)  CHECK (user_type IN ('farmer', 'customer', 'admin')),
  email         VARCHAR(255),
  city          VARCHAR(100),
  photo_url     TEXT,
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  verified      BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at    BIGINT       NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

-- Products (retail, wholesale, auction all in one table)
CREATE TABLE IF NOT EXISTS products (
  id                    VARCHAR(128)  PRIMARY KEY,
  vendor_id             VARCHAR(128)  NOT NULL,
  vendor_name           VARCHAR(255)  NOT NULL,
  title                 VARCHAR(500)  NOT NULL,
  description           TEXT,
  category              VARCHAR(100),
  images                JSONB         NOT NULL DEFAULT '[]',
  product_type          VARCHAR(20)   NOT NULL CHECK (product_type IN ('retail', 'wholesale', 'auction')),

  -- Retail / Wholesale fields
  base_price            NUMERIC(12, 2),
  stock                 INT,
  min_order_qty         INT           DEFAULT 1,
  bulk_tiers            JSONB,

  -- Auction fields
  is_auction            BOOLEAN       NOT NULL DEFAULT FALSE,
  starting_price        NUMERIC(12, 2),
  current_highest_bid   NUMERIC(12, 2),
  bid_increment         NUMERIC(12, 2),
  auction_start_time    BIGINT,
  auction_end_time      BIGINT,
  buy_now_price         NUMERIC(12, 2),
  auction_quantity      INT,
  auction_status        VARCHAR(20)   CHECK (auction_status IN ('live', 'ended', 'cancelled')),
  winner_bidder_id      VARCHAR(128),
  winner_bidder_name    VARCHAR(255),
  winner_order_id       VARCHAR(128),

  -- Status
  is_active             BOOLEAN       NOT NULL DEFAULT TRUE,
  approval_status       VARCHAR(20)   NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  submitted_at          BIGINT,
  approved_at           BIGINT,
  approved_by           VARCHAR(128),
  rejection_reason      TEXT,
  rejected_at           BIGINT,

  rating                NUMERIC(3, 2) DEFAULT 0,
  reviews_count         INT           DEFAULT 0,

  created_at            BIGINT        NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  updated_at            BIGINT        NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

-- Bids (for auction products)
CREATE TABLE IF NOT EXISTS bids (
  id           VARCHAR(128)  PRIMARY KEY,
  product_id   VARCHAR(128)  NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  bidder_id    VARCHAR(128)  NOT NULL,
  bidder_name  VARCHAR(255)  NOT NULL,
  amount       NUMERIC(12, 2) NOT NULL,
  created_at   BIGINT        NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id              VARCHAR(64)   PRIMARY KEY,
  source          VARCHAR(20)   NOT NULL DEFAULT 'checkout' CHECK (source IN ('checkout', 'auction')),
  auction_id      VARCHAR(128),
  customer_id     VARCHAR(128)  NOT NULL,
  customer_info   JSONB         NOT NULL,
  address_info    JSONB         NOT NULL,
  payment_method  VARCHAR(20)   NOT NULL CHECK (payment_method IN ('easypaisa', 'jazzcash', 'cod')),
  items           JSONB         NOT NULL,
  subtotal        NUMERIC(12, 2) NOT NULL,
  delivery_fee    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total           NUMERIC(12, 2) NOT NULL,
  status          VARCHAR(20)   NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled')),
  created_at      BIGINT        NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id          VARCHAR(128)  PRIMARY KEY,
  user_id     VARCHAR(128)  NOT NULL,
  title       VARCHAR(500)  NOT NULL,
  message     TEXT          NOT NULL,
  read        BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at  BIGINT        NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_products_vendor_id      ON products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_products_approval_status ON products(approval_status);
CREATE INDEX IF NOT EXISTS idx_products_product_type    ON products(product_type);
CREATE INDEX IF NOT EXISTS idx_bids_product_id          ON bids(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id       ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id    ON notifications(user_id);

`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("Running migrations...");
    await client.query(schema);
    console.log("✅ Migration complete — all tables created.");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
