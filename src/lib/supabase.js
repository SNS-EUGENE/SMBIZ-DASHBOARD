import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase credentials are missing. Please check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-application-name': 'smbiz-dashboard'
    }
  }
})

// Helper functions
export const api = {
  // Companies
  companies: {
    getAll: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name')
      return { data, error }
    },

    getById: async (id) => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', id)
        .single()
      return { data, error }
    },

    create: async (company) => {
      const { data, error } = await supabase
        .from('companies')
        .insert([company])
        .select()
        .single()
      return { data, error }
    },

    update: async (id, updates) => {
      const { data, error } = await supabase
        .from('companies')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      return { data, error }
    },

    delete: async (id) => {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', id)
      return { error }
    },
  },

  // Equipment
  equipment: {
    getAll: async () => {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .order('type')
      return { data, error }
    },

    getAvailable: async (date, timeSlot) => {
      // Get all equipment
      const { data: allEquipment, error: equipError } = await supabase
        .from('equipment')
        .select('*')
        .eq('status', 'active')

      if (equipError) return { data: null, error: equipError }

      // Get reserved equipment for the time slot
      const { data: reservations, error: resError } = await supabase
        .from('reservations')
        .select(`
          id,
          reservation_equipment (
            equipment_id
          )
        `)
        .eq('reservation_date', date)
        .eq('time_slot', timeSlot)
        .neq('status', 'cancelled')

      if (resError) return { data: null, error: resError }

      // Filter out reserved equipment
      const reservedIds = new Set(
        reservations.flatMap(r => r.reservation_equipment.map(re => re.equipment_id))
      )

      const available = allEquipment.filter(eq => !reservedIds.has(eq.id))

      return { data: available, error: null }
    },
  },

  // Reservations
  reservations: {
    getAll: async (filters = {}) => {
      let query = supabase
        .from('daily_reservations')
        .select('*')
        .order('reservation_date', { ascending: false })

      if (filters.startDate) {
        query = query.gte('reservation_date', filters.startDate)
      }

      if (filters.endDate) {
        query = query.lte('reservation_date', filters.endDate)
      }

      if (filters.status) {
        query = query.eq('status', filters.status)
      }

      const { data, error } = await query
      return { data, error }
    },

    getByDate: async (date) => {
      const { data, error } = await supabase
        .from('daily_reservations')
        .select('*')
        .eq('reservation_date', date)
        .order('time_slot')
      return { data, error }
    },

    create: async (reservation, equipmentIds) => {
      // Start a transaction
      const { data: newReservation, error: resError } = await supabase
        .from('reservations')
        .insert([reservation])
        .select()
        .single()

      if (resError) return { data: null, error: resError }

      // Add equipment mappings
      const equipmentMappings = equipmentIds.map(equipId => ({
        reservation_id: newReservation.id,
        equipment_id: equipId,
        usage_hours: 4.0
      }))

      const { error: equipError } = await supabase
        .from('reservation_equipment')
        .insert(equipmentMappings)

      if (equipError) {
        // Rollback: delete the reservation
        await supabase.from('reservations').delete().eq('id', newReservation.id)
        return { data: null, error: equipError }
      }

      return { data: newReservation, error: null }
    },

    update: async (id, updates) => {
      const { data, error } = await supabase
        .from('reservations')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      return { data, error }
    },

    delete: async (id) => {
      const { error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', id)
      return { error }
    },

    cancel: async (id) => {
      return api.reservations.update(id, { status: 'cancelled' })
    },
  },

  // Statistics
  stats: {
    getEquipmentUtilization: async (year, month) => {
      const { data, error } = await supabase
        .from('equipment_utilization')
        .select('*')
        .gte('month', `${year}-${String(month).padStart(2, '0')}-01`)
        .lt('month', month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`)
      return { data, error }
    },

    getDistrictStats: async (year, month) => {
      const { data, error } = await supabase
        .from('district_statistics')
        .select('*')
        .gte('month', `${year}-${String(month).padStart(2, '0')}-01`)
        .lt('month', month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`)
      return { data, error }
    },

    getIndustryStats: async (year, month) => {
      const { data, error } = await supabase
        .from('industry_statistics')
        .select('*')
        .gte('month', `${year}-${String(month).padStart(2, '0')}-01`)
        .lt('month', month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`)
      return { data, error }
    },
  },
}
