export type SaasResource =
  | 'customers' | 'products' | 'services' | 'orders' | 'payments' | 'invoices'
  | 'sites' | 'site_tasks' | 'site_incidents' | 'deliveries' | 'expenses'
  | 'wallets' | 'wallet_transactions' | 'loans' | 'support_tickets' | 'audit_events';

export type ResourceConfig = {
  table: SaasResource;
  roles: string[];
  orderBy: string;
  insertable: readonly string[];
};

const staff = ['owner','admin'];
export const SAAS_RESOURCES: Record<SaasResource, ResourceConfig> = {
  customers: { table:'customers', roles:[...staff,'accountant','support'], orderBy:'created_at DESC', insertable:['identity','name','email','phone','address','settings'] },
  products: { table:'products', roles:[...staff,'supplier'], orderBy:'created_at DESC', insertable:['sku','name','price_minor','currency','stock','active','settings'] },
  services: { table:'services', roles:[...staff,'supplier'], orderBy:'created_at DESC', insertable:['code','name','price_minor','currency','active','settings'] },
  orders: { table:'orders', roles:[...staff,'accountant','supplier','support'], orderBy:'created_at DESC', insertable:['reference','customer_id','status','currency','subtotal_minor','tax_minor','total_minor','delivery_address','settings'] },
  payments: { table:'payments', roles:[...staff,'accountant'], orderBy:'created_at DESC', insertable:[] },
  invoices: { table:'invoices', roles:[...staff,'accountant'], orderBy:'issued_at DESC', insertable:[] },
  sites: { table:'sites', roles:[...staff,'site_manager'], orderBy:'created_at DESC', insertable:['reference','name','customer_id','manager_identity','status','budget_minor','currency','address','settings'] },
  site_tasks: { table:'site_tasks', roles:[...staff,'site_manager'], orderBy:'created_at DESC', insertable:['site_id','label','status','assignee_identity','due_at','settings'] },
  site_incidents: { table:'site_incidents', roles:[...staff,'site_manager'], orderBy:'created_at DESC', insertable:['site_id','label','severity','resolved_at','settings'] },
  deliveries: { table:'deliveries', roles:[...staff,'carrier','driver'], orderBy:'created_at DESC', insertable:['order_id','driver_identity','status','destination','tracking'] },
  expenses: { table:'expenses', roles:[...staff,'accountant','site_manager'], orderBy:'created_at DESC', insertable:['site_id','label','category','amount_minor','currency','incurred_on','evidence','created_by'] },
  wallets: { table:'wallets', roles:[...staff,'accountant'], orderBy:'created_at DESC', insertable:[] },
  wallet_transactions: { table:'wallet_transactions', roles:[...staff,'accountant'], orderBy:'created_at DESC', insertable:[] },
  loans: { table:'loans', roles:[...staff,'accountant'], orderBy:'created_at DESC', insertable:['customer_id','reference','status','principal_minor','currency','term_months','details'] },
  support_tickets: { table:'support_tickets', roles:[...staff,'support'], orderBy:'created_at DESC', insertable:['customer_id','subject','message','status','settings'] },
  audit_events: { table:'audit_events', roles:staff, orderBy:'created_at DESC', insertable:[] },
};

export function isSaasResource(value: string): value is SaasResource {
  return Object.prototype.hasOwnProperty.call(SAAS_RESOURCES, value);
}
