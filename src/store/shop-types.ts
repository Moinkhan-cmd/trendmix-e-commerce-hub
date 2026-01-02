export type ShopProduct = {
  id: string;
  name: string;
  price: number;
  image?: string;
};

export type CartItem = {
  product: ShopProduct;
  qty: number;
};

