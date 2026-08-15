import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cfhhwmruhqtyxyzcxcxc.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmaGh3bXJ1aHF0eXh5emN4Y3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTg1ODAsImV4cCI6MjA5MTA3NDU4MH0.qVa0qZVgR5EkTknKSxYbpfyqU-MVtMHkNdo1vW0TVcw";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
