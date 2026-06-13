import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import ScheduleForm from '../components/ScheduleForm';

interface ScheduleGroup {
  group: {
    id: string;
  };
}

interface ScheduleResponse {
  name: string;
  message: string;
  cronExpr: string | null;
  timezone: string;
  intervalMs: string | number | null;
  scheduleGroups?: ScheduleGroup[];
  imageUrls?: string[];
}

interface SchedulePayload {
  name: string;
  message: string;
  timezone: string;
  groupIds: string[];
  imageUrls: string[];
  cronExpr?: string;
  intervalMs?: number;
}

export default function EditSchedulePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const { data: schedule, isLoading } = useQuery<ScheduleResponse>({
    queryKey: ['schedule', id],
    queryFn: async () => {
      const res = await api.get(`/schedules/${id}`);
      return res.data;
    },
    enabled: Boolean(id),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: SchedulePayload) => {
      const res = await api.put(`/schedules/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['schedule', id] });
      navigate('/schedules');
    },
    onError: (err: any) => {
      const message = err.response?.data?.message;
      setError(Array.isArray(message) ? message.join(', ') : message || 'Failed to update schedule');
    },
  });

  if (isLoading) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }

  if (!schedule) {
    return <div className="text-center py-12 text-gray-500">Schedule not found.</div>;
  }

  const initialData = {
    name: schedule.name,
    message: schedule.message,
    cronExpr: schedule.cronExpr || undefined,
    timezone: schedule.timezone,
    intervalMs: schedule.intervalMs ? Number(schedule.intervalMs) : undefined,
    groupIds: schedule.scheduleGroups?.map((sg) => sg.group.id) || [],
    imageUrls: schedule.imageUrls || [],
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Schedule</h1>

      {error && <div className="mb-4 bg-red-50 text-red-700 px-4 py-3 rounded-md text-sm">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <ScheduleForm
          initialData={initialData}
          onSubmit={(data) => updateMutation.mutate(data)}
          isSubmitting={updateMutation.isPending}
          submitLabel="Update Schedule"
        />
      </div>
    </div>
  );
}
