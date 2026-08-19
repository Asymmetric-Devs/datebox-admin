import { supabase } from "@/lib/supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

export interface BusinessClaimAdmin {
  id: number;
  businessId: string;
  status: "pending" | "approved" | "rejected";
  documentationURL: string | null;
  createdAt: string;
  reviewedAt: string | null;
  eventRequested: string | null;
  business?: {
    id: string;
    name_business: string;
    name_owner: string;
    cuit: string;
    phone: string;
    mail: string;
    subscription?: string | null;
  } | null;
  event?: {
    id: string;
    title: string;
    address?: string | null;
    category?: string;
    image_urls?: string[];
    venue_name?: string | null;
    is_temporary?: boolean;
    status?: boolean;
  } | null;
}

export interface AdminSubscriptionItem {
  id: string;
  merchant_id: string;
  plan_id: string;
  status: "pending" | "authorized" | "paused" | "cancelled" | string;
  mp_preapproval_id: string | null;
  payer_email: string | null;
  checkout_url: string | null;
  next_payment_date: string | null;
  created_at: string;
  updated_at: string | null;
  business?: {
    id: string;
    name_business: string;
    name_owner: string;
    cuit: string;
    phone: string;
    mail: string;
    subscription: string;
  } | null;
}

export interface AdminSubscriptionsData {
  subscriptions: AdminSubscriptionItem[];
  metrics: {
    totalRevenueEstimatedARS: number;
    totalSubscriptions: number;
    authorizedCount: number;
    pendingCount: number;
    pausedCount: number;
    cancelledCount: number;
  };
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  reason?: string | null;
  price_ars: number;
  currency_id?: string | null;
  frequency?: number | null;
  frequency_type?: string | null;
  billing_day?: number | null;
  billing_day_proportional?: boolean | null;
  free_trial_frequency?: number | null;
  free_trial_frequency_type?: string | null;
  repetitions?: number | null;
  back_url?: string | null;
  init_point?: string | null;
  status?: string | null;
  max_venues: number;
  max_special_events_per_month: number;
  ai_boost_percentage: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CreatePlanPayload {
  name: string;
  reason?: string;
  price_ars: number;
  currency_id?: string;
  frequency?: number;
  frequency_type?: "months" | "days";
  billing_day?: number;
  billing_day_proportional?: boolean;
  free_trial_frequency?: number;
  free_trial_frequency_type?: "months" | "days";
  repetitions?: number;
  back_url?: string;
  max_venues: number;
  max_special_events_per_month: number;
  ai_boost_percentage: number;
}

export interface CatalogItem {
  id: string;
  sourceId: string;
  title: string;
  description?: string | null;
  category: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  is_commercial: boolean;
  is_temporary: boolean;
  status: boolean;
  rating: number;
  promotion_score: number;
  starts_at?: string | null;
  ends_at?: string | null;
  open_time?: string | null;
  close_time?: string | null;
  horarios?: any;
  ticket_price?: number | null;
  duration_hours?: number | null;
  organizer_name?: string | null;
  google_maps_url?: string | null;
  google_place_id?: string | null;
  owner_id?: string | null;
  image_urls?: string[] | null;
  image_url?: string | null;
  created_at: string;
  updated_at?: string;
  tags?: { id?: string; name: string; category?: string }[];
  external_url?: string | null;
  venue_name?: string | null;
}

// -------------------------------------------------------------
// Helper to get auth header with Bearer JWT token
// -------------------------------------------------------------
export async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// -------------------------------------------------------------
// 1. Claims APIs
// -------------------------------------------------------------
export async function fetchAdminClaims(): Promise<BusinessClaimAdmin[]> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/businesses/admin/claims`, { headers });
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  } catch (err) {
    console.warn("API server fetch failed for claims, attempting direct Supabase query...", err);
  }

  // Direct Supabase query as fallback
  const { data: claims, error: claimsErr } = await supabase
    .from("business_claims_events" as any)
    .select(`
      id,
      businessId,
      status,
      documentationURL,
      createdAt,
      reviewedAt,
      eventRequested
    `)
    .order("createdAt", { ascending: false });

  if (claimsErr) throw claimsErr;
  if (!claims || claims.length === 0) return [];

  // Enrich with businesses and events
  const businessIds = Array.from(new Set(claims.map((c: any) => c.businessId).filter(Boolean)));
  const eventIds = Array.from(new Set(claims.map((c: any) => c.eventRequested).filter(Boolean)));

  const [{ data: businesses }, { data: events }] = await Promise.all([
    businessIds.length > 0
      ? supabase.from("businesses" as any).select("*").in("id", businessIds)
      : Promise.resolve({ data: [] }),
    eventIds.length > 0
      ? supabase.from("events" as any).select("*").in("id", eventIds)
      : Promise.resolve({ data: [] }),
  ]);

  const bMap = new Map((businesses || []).map((b: any) => [b.id, b]));
  const eMap = new Map((events || []).map((e: any) => [e.id, e]));

  return claims.map((c: any) => ({
    id: c.id,
    businessId: c.businessId,
    status: c.status,
    documentationURL: c.documentationURL,
    createdAt: c.createdAt,
    reviewedAt: c.reviewedAt,
    eventRequested: c.eventRequested,
    business: (bMap.get(c.businessId) as any) || null,
    event: (eMap.get(c.eventRequested) as any) || null,
  }));
}

export async function reviewClaim(claimId: number, status: "approved" | "rejected"): Promise<any> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/businesses/admin/claims/${claimId}/review`, {
    method: "POST",
    headers,
    body: JSON.stringify({ status }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || errData.error || "Error al procesar la solicitud");
  }

  return res.json();
}

// -------------------------------------------------------------
// 2. Subscriptions & Plans APIs
// -------------------------------------------------------------
export async function fetchAdminSubscriptions(): Promise<AdminSubscriptionsData> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/businesses/admin/subscriptions`, { headers });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("API server fetch failed for subscriptions, falling back to Supabase...", err);
  }

  // Fallback direct query to Supabase with full business and plan mapping
  try {
    const { data: subs, error: subsError } = await supabase
      .from("merchant_subscriptions" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (subsError || !subs) {
      console.error("Supabase merchant_subscriptions query error:", subsError);
      throw subsError || new Error("No se pudieron obtener las suscripciones");
    }

    const merchantIds = Array.from(new Set(subs.map((s: any) => s.merchant_id).filter(Boolean)));
    const businessMap: Record<string, any> = {};

    if (merchantIds.length > 0) {
      const { data: businesses, error: busError } = await supabase
        .from("businesses" as any)
        .select("*")
        .in("id", merchantIds);

      if (!busError && businesses) {
        businesses.forEach((b: any) => {
          businessMap[b.id] = b;
        });
      }
    }

    // Fetch plan prices
    const { data: plans } = await supabase
      .from("subscription_plans" as any)
      .select("id, price_ars, name");

    const planPriceMap: Record<string, number> = {};
    (plans || []).forEach((p: any) => {
      planPriceMap[p.id] = Number(p.price_ars) || 0;
      planPriceMap[p.id.toLowerCase()] = Number(p.price_ars) || 0;
    });

    let authorizedCount = 0;
    let pendingCount = 0;
    let pausedCount = 0;
    let cancelledCount = 0;
    let totalRevenueEstimatedARS = 0;

    const enrichedSubs: AdminSubscriptionItem[] = subs.map((sub: any) => {
      const b = businessMap[sub.merchant_id] || null;
      const status = sub.status || "pending";
      const planId = sub.plan_id || "base";

      if (status === "authorized") {
        authorizedCount++;
        totalRevenueEstimatedARS += planPriceMap[planId] || planPriceMap[planId.toLowerCase()] || 0;
      } else if (status === "pending") {
        pendingCount++;
      } else if (status === "paused") {
        pausedCount++;
      } else if (status === "cancelled") {
        cancelledCount++;
      }

      return {
        id: sub.id,
        merchant_id: sub.merchant_id,
        plan_id: sub.plan_id,
        status: sub.status,
        mp_preapproval_id: sub.mp_preapproval_id || null,
        payer_email: sub.payer_email || null,
        checkout_url: sub.checkout_url || null,
        next_payment_date: sub.next_payment_date || null,
        created_at: sub.created_at,
        updated_at: sub.updated_at || null,
        business: b
          ? {
              id: b.id,
              name_business: b.name_business,
              name_owner: b.name_owner,
              cuit: b.cuit,
              phone: b.phone,
              mail: b.mail,
              subscription: b.subscription,
            }
          : null,
      };
    });

    return {
      subscriptions: enrichedSubs,
      metrics: {
        totalRevenueEstimatedARS,
        totalSubscriptions: enrichedSubs.length,
        authorizedCount,
        pendingCount,
        pausedCount,
        cancelledCount,
      },
    };
  } catch (fallbackErr) {
    console.error("Direct Supabase fallback failed for subscriptions:", fallbackErr);
    return {
      subscriptions: [],
      metrics: {
        totalRevenueEstimatedARS: 0,
        totalSubscriptions: 0,
        authorizedCount: 0,
        pendingCount: 0,
        pausedCount: 0,
        cancelledCount: 0,
      },
    };
  }
}

export async function fetchAdminPlans(): Promise<SubscriptionPlan[]> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/businesses/admin/plans`, { headers });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("API server fetch failed for plans, falling back...", err);
  }

  const { data, error } = await supabase
    .from("subscription_plans" as any)
    .select("*")
    .order("price_ars", { ascending: true });

  if (error) throw error;
  return (data || []).map((p: any) => ({
    ...p,
    price_ars: Number(p.price_ars),
  }));
}

export async function createAdminPlan(payload: CreatePlanPayload): Promise<SubscriptionPlan> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/businesses/admin/plans`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || errData.error || "Error al crear el plan de suscripción");
  }

  return res.json();
}

// -------------------------------------------------------------
// 3. Catalog & Events APIs
// -------------------------------------------------------------
export async function fetchCatalogContent(): Promise<CatalogItem[]> {
  try {
    const { data, error } = await supabase
      .from("events" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      return data.map((ev: any) => ({
        ...ev,
        sourceId: "datebox",
        image_url: ev.image_urls?.[0] ?? null,
        tags: [],
        venue_name: ev.venue_name ?? null,
      }));
    }
  } catch (err) {
    console.warn("Supabase fetch failed for events, falling back to API...", err);
  }

  // Fallback to API
  const res = await fetch(`${API_URL}/events?page=1&pageSize=100`);
  if (res.ok) {
    const json = await res.json();
    return (json.data || []).map((ev: any) => ({
      ...ev,
      sourceId: "datebox",
      image_url: ev.image_urls?.[0] ?? null,
      tags: ev.tags ?? [],
      venue_name: ev.venue_name ?? null,
    }));
  }

  return [];
}

export async function toggleCatalogStatus(id: string, newStatus: boolean): Promise<void> {
  const { error } = await supabase
    .from("events" as any)
    .update({ status: newStatus })
    .eq("id", id);

  if (error) throw error;
}
