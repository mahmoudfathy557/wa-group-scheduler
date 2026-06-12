import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import toast from "react-hot-toast";
import TimezoneSelect from "react-timezone-select";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import { api } from "../lib/api";
import {
  CronBuilder,
  MIN_CRON_INTERVAL_MINUTES,
  violatesMinCronInterval
} from "../components/CronBuilder";

const schema = z.object({
  messageText: z.string().min(1).max(4096),
  cronExpression: z
    .string()
    .min(1)
    .refine((expr) => !violatesMinCronInterval(expr), {
      message: `Cron period must be ${MIN_CRON_INTERVAL_MINUTES} minutes or more`
    }),
  timezone: z.string().min(1),
  groupIds: z.array(z.string()).min(1, "Select at least one group"),
  imageUrls: z.array(z.string().url()).max(5).optional(),
  runNow: z.boolean().optional()
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

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [groupFilter, setGroupFilter] = useState("");

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
    setValue,
    getValues,
    watch,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: {
      messageText: "",
      cronExpression: "0 9 * * *",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      groupIds: [],
      imageUrls: [],
      runNow: true
    }
  });

  useEffect(() => {
    if (existing) {
      reset({
        messageText: existing.messageText,
        cronExpression: existing.cronExpression,
        timezone: existing.timezone,
        groupIds: existing.groupLinks.map((l: any) => l.group.id),
        imageUrls: existing.imageUrls || [],
        runNow: false
      });
    }
  }, [existing, reset]);

  const imageUrls = watch("imageUrls") || [];

  const filePreviews = useMemo(
    () =>
      selectedFiles.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })),
    [selectedFiles]
  );

  useEffect(() => {
    return () => {
      filePreviews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [filePreviews]);

  function onEmojiClick(emoji: EmojiClickData) {
    const current = getValues("messageText") || "";
    setValue("messageText", `${current}${emoji.emoji}`, {
      shouldValidate: true
    });
  }

  function onSelectImages(filesList: FileList | null) {
    const files = Array.from(filesList || []);
    const existingCount = (getValues("imageUrls") || []).length;
    const remainingSlots = Math.max(
      0,
      5 - existingCount - selectedFiles.length
    );
    const next = files.slice(0, remainingSlots);

    if (files.length > remainingSlots) {
      toast.error("You can attach up to 5 images total");
    }

    const nonImages = next.filter((f) => !f.type.startsWith("image/"));
    if (nonImages.length) {
      toast.error("Only image files are allowed");
      return;
    }

    setSelectedFiles((prev) => [...prev, ...next]);
  }

  function removeExistingImage(url: string) {
    setValue(
      "imageUrls",
      (getValues("imageUrls") || []).filter((x) => x !== url),
      { shouldValidate: true }
    );
  }

  function removeSelectedFile(idx: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onSubmit(v: FormVals) {
    try {
      const fd = new FormData();
      fd.append("messageText", v.messageText);
      fd.append("cronExpression", v.cronExpression);
      fd.append("timezone", v.timezone);
      fd.append("runNow", String(Boolean(v.runNow)));
      v.groupIds.forEach((g) => fd.append("groupIds", g));
      if ((v.imageUrls || []).length > 0) {
        (v.imageUrls || []).forEach((url) => fd.append("imageUrls", url));
      } else {
        fd.append("imageUrls", "");
      }
      selectedFiles.forEach((file) => fd.append("images", file));

      if (isEdit) await api.patch(`/schedules/${id}`, fd);
      else await api.post("/schedules", fd);
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
        <div className="relative">
          <textarea
            {...register("messageText")}
            rows={4}
            className="w-full border rounded px-3 py-2"
          />
          <button
            type="button"
            className="absolute right-2 bottom-2 border rounded px-2 py-1 text-sm bg-white"
            onClick={() => setShowEmojiPicker((s) => !s)}
          >
            Emoji
          </button>
          {showEmojiPicker && (
            <div className="absolute right-0 mt-2 z-20">
              <EmojiPicker onEmojiClick={onEmojiClick} />
            </div>
          )}
        </div>
        {errors.messageText && (
          <p className="text-red-600 text-sm">{errors.messageText.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm mb-1">Images (up to 5)</label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            onSelectImages(e.target.files);
            e.currentTarget.value = "";
          }}
          className="block w-full text-sm"
        />

        {(imageUrls.length > 0 || filePreviews.length > 0) && (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {imageUrls.map((url) => (
              <div
                key={url}
                className="relative border rounded overflow-hidden"
              >
                <img
                  src={url}
                  alt="Schedule attachment"
                  className="w-full h-28 object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeExistingImage(url)}
                  className="absolute top-1 right-1 bg-white border rounded px-1 text-xs"
                >
                  Remove
                </button>
              </div>
            ))}

            {filePreviews.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                className="relative border rounded overflow-hidden"
              >
                <img
                  src={file.url}
                  alt={file.name}
                  className="w-full h-28 object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeSelectedFile(idx)}
                  className="absolute top-1 right-1 bg-white border rounded px-1 text-xs"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
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
            <>
              <input
                type="text"
                placeholder="Search groups..."
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="w-full border rounded px-3 py-2 mb-2 text-sm"
              />
              <div className="border rounded p-2 max-h-60 overflow-auto">
                {!groups || groups.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No groups — sync from the Groups page first.
                  </p>
                ) : (
                  groups
                    .filter((g) =>
                      g.name.toLowerCase().includes(groupFilter.toLowerCase())
                    )
                    .map((g) => (
                      <label
                        key={g.id}
                        className="flex items-center gap-2 py-1"
                      >
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
            </>
          )}
        />
        {errors.groupIds && (
          <p className="text-red-600 text-sm">
            {errors.groupIds.message as string}
          </p>
        )}
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register("runNow")} />
          <span>
            Send once immediately on save, then continue scheduled runs
          </span>
        </label>
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
