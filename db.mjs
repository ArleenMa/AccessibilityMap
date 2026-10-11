
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error(
        'Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env'
    );
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
    }
});

export async function getReports() {
    const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });

    if (error) throw error;

    return data ?? [];
}

export async function insertReport(report) {
    const newReport = {
        shape: report.shape,
        location_label: report.locationLabel ?? null,
        lat: report.lat,
        lng: report.lng,
        radius: report.radius,
        start_lat: report.startLat,
        start_lng: report.startLng,
        end_lat: report.endLat,
        end_lng: report.endLng,
        category: report.category,
        description: report.description ?? null,
        severity: report.severity,
        expected_duration: report.expectedDuration ?? null
    };

    const { data, error } = await supabase
        .from('reports')
        .insert(newReport)
        .select('*')
        .single();

    if (error) throw error;

    return data;
}

export async function resolveReport(id) {
    const { data, error } = await supabase
        .from('reports')
        .update({ resolved: 1 })
        .eq('id', id)
        .select('*')
        .maybeSingle();

    if (error) throw error;

    return data;
}
