import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://fexnmrpevxyknhvmhjwj.supabase.co";
const supabaseAnonKey = "sb_publishable_KD9l6816gnfgv2iIUJoHLg_lX0ZUXer";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);