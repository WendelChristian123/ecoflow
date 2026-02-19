export const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") ?? "";
export const ASAAS_BASE_URL = Deno.env.get("ASAAS_BASE_URL") ?? "https://sandbox.asaas.com/api/v3";

export interface AsaasCustomer {
  id?: string;
  name: string;
  cpfCnpj: string;
  email?: string;
  mobilePhone?: string;
  externalReference?: string;
  notificationDisabled?: boolean;
}

export interface AsaasSubscription {
  customer: string;
  billingType: "BOLETO" | "CREDIT_CARD" | "PIX" | "UNDEFINED";
  value: number;
  nextDueDate: string;
  cycle: "MONTHLY" | "SEMIANNUALLY" | "YEARLY";
  description?: string;
  externalReference?: string;
  creditCard?: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  creditCardHolderInfo?: {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    phone: string;
  };
}

export class AsaasClient {
  private headers: HeadersInit;

  constructor() {
    if (!ASAAS_API_KEY) {
      console.error("Missing ASAAS_API_KEY");
    }
    this.headers = {
      "Content-Type": "application/json",
      "access_token": ASAAS_API_KEY,
    };
  }

  public async request<T>(path: string, method: string, body?: any): Promise<T> {
    const url = `${ASAAS_BASE_URL}${path}`;
    const options: RequestInit = {
      method,
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    };

    console.log(`[Asaas] ${method} ${path}`);

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      console.error(`[Asaas Error] ${path}:`, JSON.stringify(data));
      throw new Error(data.errors?.[0]?.description || "Erro na comunicação com Asaas");
    }

    return data as T;
  }

  // --- Customers ---
  async getCustomer(cpfCnpj: string): Promise<AsaasCustomer | null> {
    const data = await this.request<{ data: AsaasCustomer[] }>(`/customers?cpfCnpj=${cpfCnpj}`, "GET");
    return data.data?.[0] || null;
  }

  async createCustomer(customer: AsaasCustomer): Promise<AsaasCustomer> {
    // Check if exists first to avoid duplicates (best effort)
    const existing = await this.getCustomer(customer.cpfCnpj);
    if (existing && existing.id) return existing;

    return this.request<AsaasCustomer>("/customers", "POST", customer);
  }

  // --- Subscriptions ---
  async createSubscription(subscription: AsaasSubscription): Promise<any> {
    return this.request("/subscriptions", "POST", subscription);
  }

  async cancelSubscription(id: string): Promise<any> {
    return this.request(`/subscriptions/${id}`, "DELETE");
  }

  async getSubscription(id: string): Promise<any> {
    return this.request(`/subscriptions/${id}`, "GET");
  }

  // --- Payments ---
  async createPayment(payment: any): Promise<any> {
    return this.request("/payments", "POST", payment);
  }

  async getPayment(id: string): Promise<any> {
    return this.request(`/payments/${id}`, "GET");
  }

  async getPixQrCode(id: string): Promise<{ encodedImage: string; payload: string; expirationDate: string }> {
    return this.request(`/payments/${id}/pixQrCode`, "GET");
  }
}
