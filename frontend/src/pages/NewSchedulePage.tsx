import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import ScheduleForm from '../components/ScheduleForm';

interface SchedulePayload {
  name: string;
  message: string;
  timezone: string;
  groupIds: string[];
  imageUrls: string[];
  cronExpr?: string;
  intervalMs?: number;
}

export default function NewSchedulePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: async (data: SchedulePayload) => {
      const res = await api.post('/schedules', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      navigate('/schedules');
    },
    onError: (err: any) => {
      const message = err.response?.data?.message;
      setError(Array.isArray(message) ? message.join(', ') : message || 'Failed to create schedule');
    },
  });

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Schedule</h1>

      {error && <div className="mb-4 bg-red-50 text-red-700 px-4 py-3 rounded-md text-sm">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <ScheduleForm
          onSubmit={(data) => createMutation.mutate(data)}
          isSubmitting={createMutation.isPending}
          submitLabel="Create Schedule"
        />
      </div>
    </div>
  );
}
