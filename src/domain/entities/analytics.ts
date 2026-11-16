import type { Priority } from './identity'
import type { Task } from './kanban'

export interface StatusDatum {
  columnId: string
  label: string
  count: number
  color: string
}

export interface TrendDatum {
  date: string
  label: string
  created: number
  completed: number
}

export interface WorkloadDatum {
  uid: string
  name: string
  photoURL: string | null
  total: number
  completed: number
  open: number
}

export interface PriorityDatum {
  priority: Priority
  label: string
  count: number
  color: string
}

export interface DashboardMetrics {
  total: number
  completed: number
  open: number
  overdue: number
  waitingReview: number
  urgentOpen: number
  dueSoon: Task[]
  completionRate: number
  byStatus: StatusDatum[]
  byPriority: PriorityDatum[]
  trend: TrendDatum[]
  workload: WorkloadDatum[]
  updatedAt: string
}
