import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import api from '../lib/api';
import { getToken } from '../lib/auth';
import { Wifi, WifiOff, RefreshCw, LogOut } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

type WaStatus = 'disconnected' | 'connecting' | 'connected' | 'qr' | string;

export default function ConnectPage() {
  const queryClient = useQueryClient();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<WaStatus | null>(null);

  const { data: statusData } = useQuery({
    queryKey: ['wa-status'],
    queryFn: async () => {
      const res = await api.get('/whatsapp/status');
      return res.data as { status: string; qr?: string | null };
    },
    refetchInterval: 5000,
  });

  const status = liveStatus || statusData?.status || 'disconnected';

  useEffect(() => {
    if (statusData?.status === 'qr' && statusData.qr) {
      setQrCode(statusData.qr);
    }
    if (statusData?.status === 'connected') {
      setQrCode(null);
    }
  }, [statusData]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const socket = io(API_BASE, {
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('wa:status', (data: { status: string; qr?: string }) => {
      setLiveStatus(data.status);
      if (data.status === 'qr' && data.qr) {
        setQrCode(data.qr);
      } else if (data.status === 'connected') {
        setQrCode(null);
        queryClient.invalidateQueries({ queryKey: ['wa-status'] });
      } else if (data.status === 'disconnected') {
        setQrCode(null);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [queryClient]);

  const connectMutation = useMutation({
    mutationFn: async () => {
      await api.post('/whatsapp/connect');
    },
    onSuccess: () => {
      setLiveStatus('connecting');
      queryClient.invalidateQueries({ queryKey: ['wa-status'] });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await api.delete('/whatsapp/disconnect');
    },
    onSuccess: () => {
      setLiveStatus('disconnected');
      setQrCode(null);
      queryClient.invalidateQueries({ queryKey: ['wa-status'] });
    },
  });

  const statusColor =
    {
      connected: 'text-green-600',
      connecting: 'text-yellow-600',
      disconnected: 'text-gray-500',
      qr: 'text-blue-600',
    }[status] || 'text-gray-500';

  const statusLabel =
    {
      connected: 'Connected',
      connecting: 'Connecting...',
      disconnected: 'Disconnected',
      qr: 'Scan QR Code',
    }[status] || status;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">WhatsApp Connection</h1>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 max-w-md">
        <div className="flex items-center gap-3 mb-6">
          {status === 'connected' ? (
            <Wifi className="w-8 h-8 text-green-600" />
          ) : (
            <WifiOff className="w-8 h-8 text-gray-400" />
          )}
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <p className={`font-semibold ${statusColor}`}>{statusLabel}</p>
          </div>
        </div>

        {status === 'qr' && qrCode && (
          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-3">
              Scan this QR code with WhatsApp on your phone:
              <br />
              Phone → WhatsApp → Linked Devices → Link a Device
            </p>
            <div className="flex justify-center p-4 bg-white border rounded-lg">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCode)}`}
                alt="WhatsApp QR Code"
                className="w-48 h-48"
              />
            </div>
          </div>
        )}

        {status === 'connecting' && (
          <div className="mb-6 flex items-center gap-2 text-yellow-600">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-sm">Waiting for WhatsApp connection...</span>
          </div>
        )}

        <div className="flex gap-3">
          {status !== 'connected' && (
            <button
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending || status === 'connecting'}
              className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {connectMutation.isPending ? 'Starting...' : 'Start QR Session'}
            </button>
          )}

          {status === 'connected' && (
            <button
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              {disconnectMutation.isPending ? 'Disconnecting...' : 'Disconnect'}
            </button>
          )}
        </div>

        <p className="mt-4 text-xs text-gray-400">
          ⚠️ Using an unofficial WhatsApp library. May violate WhatsApp ToS.
        </p>
      </div>
    </div>
  );
}
