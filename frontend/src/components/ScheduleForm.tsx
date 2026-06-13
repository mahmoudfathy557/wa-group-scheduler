import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { Upload, X } from 'lucide-react';

interface Group {
  id: string;
  name: string;
  waGroupId: string;
}

interface ScheduleFormData {
  name: string;
  message: string;
  mode: 'cron' | 'interval';
  cronExpr: string;
  intervalMs: number;
  timezone: string;
  groupIds: string[];
  imageUrls: string[];
}

interface SubmitPayload {
  name: string;
  message: string;
  timezone: string;
  groupIds: string[];
  imageUrls: string[];
  cronExpr?: string;
  intervalMs?: number;
}

interface ScheduleFormProps {
  initialData?: Partial<ScheduleFormData>;
  onSubmit: (data: SubmitPayload) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

const CRON_EXAMPLES = [
  { label: 'Every 30 minutes', value: '*/30 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 2 hours', value: '0 */2 * * *' },
  { label: 'Daily at 9am', value: '0 9 * * *' },
  { label: 'Weekdays at 9am', value: '0 9 * * 1-5' },
];

export default function ScheduleForm({
  initialData,
  onSubmit,
  isSubmitting = false,
  submitLabel = 'Save',
}: ScheduleFormProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [message, setMessage] = useState(initialData?.message || '');
  const [mode, setMode] = useState<'cron' | 'interval'>(
    initialData?.intervalMs ? 'interval' : 'cron',
  );
  const [cronExpr, setCronExpr] = useState(initialData?.cronExpr || '*/30 * * * *');
  const [intervalMin, setIntervalMin] = useState(
    initialData?.intervalMs ? Math.round(initialData.intervalMs / 60000) : 30,
  );
  const [timezone, setTimezone] = useState(initialData?.timezone || 'UTC');
  const [selectedGroups, setSelectedGroups] = useState<string[]>(initialData?.groupIds || []);
  const [imageUrls, setImageUrls] = useState<string[]>(initialData?.imageUrls || []);
  const [groupSearch, setGroupSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: async () => {
      const res = await api.get('/groups');
      return res.data;
    },
  });

  const filteredGroups = useMemo(
    () => groups.filter((g) => g.name.toLowerCase().includes(groupSearch.toLowerCase())),
    [groupSearch, groups],
  );

  function toggleGroup(id: string) {
    setSelectedGroups((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) {
      return;
    }
    if (imageUrls.length + files.length > 5) {
      setUploadError('You can upload up to 5 images.');
      e.target.value = '';
      return;
    }

    setUploadError('');
    setUploading(true);
    try {
      const form = new FormData();
      Array.from(files).forEach((file) => form.append('images', file));
      const res = await api.post('/upload/images', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImageUrls((prev) => [...prev, ...res.data.urls]);
    } catch (err) {
      setUploadError('Upload failed. Please try again.');
      console.error('Upload failed', err);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  function removeImage(url: string) {
    setImageUrls((prev) => prev.filter((existingUrl) => existingUrl !== url));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const data: SubmitPayload = {
      name,
      message,
      timezone,
      groupIds: selectedGroups,
      imageUrls,
    };

    if (mode === 'cron') {
      data.cronExpr = cronExpr;
    } else {
      data.intervalMs = intervalMin * 60 * 1000;
    }

    onSubmit(data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Schedule Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="Daily announcement"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={4}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="Your message text..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Schedule Mode</label>
        <div className="flex rounded-md border border-gray-300 overflow-hidden w-fit">
          <button
            type="button"
            onClick={() => setMode('cron')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'cron' ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Cron Expression
          </button>
          <button
            type="button"
            onClick={() => setMode('interval')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'interval'
                ? 'bg-green-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Fixed Interval
          </button>
        </div>
      </div>

      {mode === 'cron' ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cron Expression</label>
          <input
            type="text"
            value={cronExpr}
            onChange={(e) => setCronExpr(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="*/30 * * * *"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {CRON_EXAMPLES.map((example) => (
              <button
                key={example.value}
                type="button"
                onClick={() => setCronExpr(example.value)}
                className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
              >
                {example.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">Minimum interval: 30 minutes</p>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Interval (minutes)</label>
          <input
            type="number"
            value={intervalMin}
            onChange={(e) => setIntervalMin(Number(e.target.value))}
            min={30}
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <p className="text-xs text-gray-400 mt-1">Minimum 30 minutes</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Groups ({selectedGroups.length} selected)
        </label>
        <input
          type="text"
          value={groupSearch}
          onChange={(e) => setGroupSearch(e.target.value)}
          placeholder="Search groups..."
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
          {filteredGroups.length === 0 ? (
            <p className="text-sm text-gray-400 px-3 py-3">
              No groups found. Sync from the Groups page first.
            </p>
          ) : (
            filteredGroups.map((group) => (
              <label
                key={group.id}
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedGroups.includes(group.id)}
                  onChange={() => toggleGroup(group.id)}
                  className="rounded text-green-600"
                />
                <span className="text-sm text-gray-700">{group.name}</span>
              </label>
            ))
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Image Attachments ({imageUrls.length}/5)
        </label>
        {imageUrls.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {imageUrls.map((url) => (
              <div key={url} className="relative group">
                <img
                  src={url}
                  alt="attachment"
                  className="w-16 h-16 object-cover rounded-md border border-gray-200"
                />
                <button
                  type="button"
                  onClick={() => removeImage(url)}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        {imageUrls.length < 5 && (
          <label className="flex items-center gap-2 cursor-pointer w-fit px-3 py-2 border border-dashed border-gray-300 rounded-md hover:border-green-400 transition-colors">
            <Upload className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">
              {uploading ? 'Uploading...' : 'Add images'}
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        )}
        {uploadError && <p className="mt-2 text-sm text-red-600">{uploadError}</p>}
      </div>

      <button
        type="submit"
        disabled={isSubmitting || selectedGroups.length === 0}
        className="w-full bg-green-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        {isSubmitting ? 'Saving...' : submitLabel}
      </button>
    </form>
  );
}
