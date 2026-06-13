import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { Plus, Pause, Play, Pencil, Trash2, Calendar } from 'lucide-react';

interface Schedule {
  id: string;
  name: string;
  message: string;
  cronExpr: string | null;
  timezone: string;
  intervalMs: string | null;
  status: 'active' | 'paused';
  scheduleGroups: { group: { name: string } }[];
}

export default function SchedulesPage() {
  const queryClient = useQueryClient();

  const { data: schedules = [], isLoading } = useQuery<Schedule[]>({
    queryKey: ['schedules'],
    queryFn: async () => {
      const res = await api.get('/schedules');
      return res.data;
    },
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/schedules/${id}/pause`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedules'] }),
  });

  const resumeMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/schedules/${id}/resume`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedules'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/schedules/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedules'] }),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Schedules</h1>
        <Link
          to="/schedules/new"
          className="flex items-center gap-2 bg-green-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Schedule
        </Link>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : schedules.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm mb-4">No schedules yet.</p>
          <Link
            to="/schedules/new"
            className="inline-flex items-center gap-2 bg-green-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-green-700"
          >
            <Plus className="w-4 h-4" />
            Create your first schedule
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.map((schedule) => (
            <div key={schedule.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 text-sm">{schedule.name}</h3>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        schedule.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {schedule.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 truncate mb-2">{schedule.message}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                    <span>
                      {schedule.cronExpr
                        ? `Cron: ${schedule.cronExpr}`
                        : schedule.intervalMs
                          ? `Every ${Math.round(Number(schedule.intervalMs) / 60000)} min`
                          : '—'}
                    </span>
                    <span>TZ: {schedule.timezone}</span>
                    <span>
                      Groups: {schedule.scheduleGroups.map((sg) => sg.group.name).join(', ') || '—'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {schedule.status === 'active' ? (
                    <button
                      onClick={() => pauseMutation.mutate(schedule.id)}
                      disabled={pauseMutation.isPending}
                      className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-md transition-colors"
                      title="Pause"
                    >
                      <Pause className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => resumeMutation.mutate(schedule.id)}
                      disabled={resumeMutation.isPending}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                      title="Resume"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                  <Link
                    to={`/schedules/${schedule.id}/edit`}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => {
                      if (window.confirm('Delete this schedule?')) {
                        deleteMutation.mutate(schedule.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
