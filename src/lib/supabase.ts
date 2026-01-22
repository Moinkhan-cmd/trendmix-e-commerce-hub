import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://oyceqaemlspsgzkunbdm.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95Y2VxYWVtbHNwc2d6a3VuYmRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxMDU3NDMsImV4cCI6MjA4MzY4MTc0M30.GulPPyRlveyuF-alSZVegfDfH0kQBvbgyojmDJDkHH8";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
