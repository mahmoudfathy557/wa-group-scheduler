import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import toast from "react-hot-toast";
import TimezoneSelect from "react-timezone-select";
import { api } from "../lib/api";
import { CronBuilder } from "../components/CronBuilder";

const schema = z.object({
  messageText: z.string().min(1).max(4096),
  cronExpression: z.string().min(1),
  timezone: z.string().min(1),
  groupIds: z.array(z.string()).min(1, "Select at least one group")
});
type FormVals = z.infer<typeof schema>;

interface Group {
  id: string;
  name: string;
}

export function ScheduleForm() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const nav = useNavigate();

  const { data: groups } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => (await api.get<Group[]>("/groups")).data
  });

  const { data: existing } = useQuery({
    queryKey: ["schedule", id],
    enabled: isEdit,
    queryFn: async () => (await api.get(`/schedules/${id}`)).data
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: {
      messageText: "",
      cronExpression: "0 9 * * *",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      groupIds: []
    }
  });

  useEffect(() => {
    if (existing) {
      reset({
        messageText: existing.messageText,
        cronExpression: existing.cronExpression,
        timezone: existing.timezone,
        groupIds: existing.groupLinks.map((l: any) => l.group.id)
      });
    }
  }, [existing, reset]);

  async function onSubmit(v: FormVals) {
    try {
      if (isEdit) await api.patch(`/schedules/${id}`, v);
      else await api.post("/schedules", v);
      toast.success("Saved");
      nav("/schedules");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Save failed");
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-white p-6 rounded shadow max-w-2xl space-y-4"
    >
      <h2 className="text-xl font-semibold">
        {isEdit ? "Edit schedule" : "New schedule"}
      </h2>

      <div>
        <label className="block text-sm mb-1">Message text</label>
        <textarea
          {...register("messageText")}
          rows={4}
          className="w-full border rounded px-3 py-2"
        />
        {errors.messageText && (
          <p className="text-red-600 text-sm">{errors.messageText.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm mb-1">Schedule</label>
        <Controller
          name="cronExpression"
          control={control}
          render={({ field }) => (
            <CronBuilder
              value={field.value}
              onChange={field.onChange}
              error={errors.cronExpression?.message}
            />
          )}
        />
      </div>

      <div>
        <label className="block text-sm mb-1">Timezone</label>
        <Controller
          name="timezone"
          control={control}
          render={({ field }) => (
            <TimezoneSelect
              value={field.value}
              onChange={(tz) =>
                field.onChange(typeof tz === "string" ? tz : tz.value)
              }
            />
          )}
        />
      </div>

      <div>
        <label className="block text-sm mb-1">Groups</label>
        <Controller
          name="groupIds"
          control={control}
          render={({ field }) => (
            <div className="border rounded p-2 max-h-60 overflow-auto">
              {!groups || groups.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No groups — sync from the Groups page first.
                </p>
              ) : (
                groups.map((g) => (
                  <label key={g.id} className="flex items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      checked={field.value.includes(g.id)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...field.value, g.id]
                          : field.value.filter((x) => x !== g.id);
                        field.onChange(next);
                      }}
                    />
                    <span className="text-sm">{g.name}</span>
                  </label>
                ))
              )}
            </div>
          )}
        />
        {errors.groupIds && (
          <p className="text-red-600 text-sm">
            {errors.groupIds.message as string}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          disabled={isSubmitting}
          className="bg-emerald-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {isSubmitting ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => nav("/schedules")}
          className="px-4 py-2 rounded border"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
