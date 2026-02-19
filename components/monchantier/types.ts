export type Language = "fr" | "en";

export type Currency = "USD" | "CDF";

export type PaymentMethod = "mobilemoney" | "card" | "paypal";

export type MobileNetwork = "vodacom" | "airtel" | "orange" | "mpesa";

export type PartnerType = "transporter" | "supplier" | "artisan";

export type Status = "idle" | "loading" | "success" | "error";

export interface Product {
  id: number;
  fr: string;
  en: string;
  price: string;
  prices: { USD: number | null; CDF: number | null };
  unitFr: string;
  unitEn: string;
  img: string;
  fallback: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Service {
  icon: string;
  fr: string;
  en: string;
  frDesc: string;
  enDesc: string;
}

export interface PartnerForm {
  company: string;
  fullname: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  vehicleTypes: string;
  capacity: string;
  zones: string;
  products: string;
  minOrder: string;
  deliveryAvailable: boolean;
  specialty: string;
  experience: string;
  certifications: string;
  notes: string;
}

export interface ContactForm {
  name: string;
  email: string;
  phone: string;
  message: string;
}
