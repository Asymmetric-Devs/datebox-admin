import { create } from "zustand";
import { supabase } from "../lib/supabase";

export interface AdminUser {
  id: string;
  email: string;
  role: "admin";
  created_at?: string;
}

interface AuthState {
  user: AdminUser | null;
  isLoading: boolean;
  isInitialized: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isInitialized: false,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      // 1. Authenticate with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        set({ isLoading: false });
        return { success: false, error: authError.message || "Credenciales incorrectas" };
      }

      if (!authData.user) {
        set({ isLoading: false });
        return { success: false, error: "Usuario no encontrado" };
      }

      // 2. Verify admin permission in public.admins
      const { data: adminData, error: adminQueryError } = await supabase
        .from("admins")
        .select("user_id, createdat")
        .eq("user_id", authData.user.id)
        .maybeSingle();

      if (adminQueryError) {
        console.error("Error verificando permisos de admin:", adminQueryError);
      }

      if (!adminData) {
        // User is not an admin - disconnect
        await supabase.auth.signOut();
        set({ user: null, isLoading: false });
        return {
          success: false,
          error: "Acceso denegado. Tu cuenta no cuenta con permisos de Administrador en DateBox.",
        };
      }

      const adminUser: AdminUser = {
        id: authData.user.id,
        email: authData.user.email || email,
        role: "admin",
        created_at: adminData.createdat,
      };

      set({ user: adminUser, isLoading: false });
      return { success: true };
    } catch (err: any) {
      set({ isLoading: false });
      return { success: false, error: err.message || "Error al iniciar sesión" };
    }
  },

  logout: async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      set({ user: null });
    }
  },

  checkSession: async () => {
    set({ isLoading: true });
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionUser = sessionData.session?.user;

      if (!sessionUser) {
        set({ user: null, isLoading: false, isInitialized: true });
        return;
      }

      const { data: adminData } = await supabase
        .from("admins")
        .select("user_id, createdat")
        .eq("user_id", sessionUser.id)
        .maybeSingle();

      if (!adminData) {
        await supabase.auth.signOut();
        set({ user: null, isLoading: false, isInitialized: true });
        return;
      }

      set({
        user: {
          id: sessionUser.id,
          email: sessionUser.email || "",
          role: "admin",
          created_at: adminData.createdat,
        },
        isLoading: false,
        isInitialized: true,
      });
    } catch (e) {
      console.error("Error checking session:", e);
      set({ user: null, isLoading: false, isInitialized: true });
    }
  },
}));
