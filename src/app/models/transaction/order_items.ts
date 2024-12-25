import { Order } from '../products';
import { ShippingInfo } from '../shipping';
import { PurchaseType } from './purchaseType';

export interface OrderItems {
  productID: string;
  productName: string;
  isVariation: boolean;
  variationID: string;
  quantity: number;
  purchaseType: PurchaseType | undefined;
  cost: number;
  price: number;
  imageUrl: string;
  shippingInfo: ShippingInfo;
}

export const ordersToOrderItems = (order: Order[]): OrderItems[] => {
  let orderList: OrderItems[] = [];
  order.map((order) => {
    orderList.push({
      productID: order.productID,
      productName: order.name,
      isVariation: order.isVariation,
      variationID: order.variatioID,
      quantity: order.quantity,
      purchaseType : order.purchaseType,
      cost: order.cost,
      price: order.price,
      imageUrl: order.image,
      shippingInfo: order.shippingInfo,
    });
  });
  return orderList;
};
