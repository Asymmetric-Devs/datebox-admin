import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://scrawkmumxaqxriddavu.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjcmF3a211bXhhcXhyaWRkYXZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxNzg0NDUsImV4cCI6MjEwNDc1NDQ0NX0.7MUpEwd4pZwSwLEdizRq-0k7S098jsFQPSU0tRhOSIM";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
