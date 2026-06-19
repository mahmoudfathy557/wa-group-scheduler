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
      className="bg-white rounded-lg shadow-md p-4 sm:p-6 max-w-full sm:max-w-2xl space-y-5"
    >
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
        {isEdit ? "Edit schedule" : "New schedule"}
      </h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Message text
        </label>
        <div className="relative">
          <textarea
            {...register("messageText")}
            rows={5}
            placeholder="Enter the message you want to send"
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition resize-vertical"
          />
          <button
            type="button"
            className="absolute right-3 bottom-3 border border-gray-300 hover:bg-gray-50 rounded-lg px-3 py-1.5 text-xs sm:text-sm bg-white font-medium transition"
            onClick={() => setShowEmojiPicker((s) => !s)}
          >
            😀 Emoji
          </button>
          {showEmojiPicker && (
            <div
              className="absolute right-0 mt-2 z-20 border border-gray-200 rounded-lg shadow-lg bg-white"
              style={{ maxHeight: "400px", overflowY: "auto" }}
            >
              <EmojiPicker onEmojiClick={onEmojiClick} />
            </div>
          )}
        </div>
        {errors.messageText && (
          <p className="text-red-600 text-xs sm:text-sm mt-1">
            {errors.messageText.message}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Images (up to 5)
        </label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            onSelectImages(e.target.files);
            e.currentTarget.value = "";
          }}
          className="block w-full text-xs sm:text-sm border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
        />

        {(imageUrls.length > 0 || filePreviews.length > 0) && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {imageUrls.map((url) => (
              <div
                key={url}
                className="relative border-2 border-gray-200 rounded-lg overflow-hidden group hover:border-emerald-400 transition"
              >
                <img
                  src={url}
                  alt="Schedule attachment"
                  className="w-full h-24 sm:h-28 object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeExistingImage(url)}
                  className="absolute top-1 right-1 bg-white border border-gray-300 hover:bg-red-50 rounded-md px-2 py-1 text-xs font-medium opacity-0 group-hover:opacity-100 transition"
                >
                  ✕
                </button>
              </div>
            ))}

            {filePreviews.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                className="relative border-2 border-dashed border-emerald-300 rounded-lg overflow-hidden group hover:border-emerald-500 transition"
              >
                <img
                  src={file.url}
                  alt={file.name}
                  className="w-full h-24 sm:h-28 object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeSelectedFile(idx)}
                  className="absolute top-1 right-1 bg-white border border-gray-300 hover:bg-red-50 rounded-md px-2 py-1 text-xs font-medium opacity-0 group-hover:opacity-100 transition"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Schedule
        </label>
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
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Timezone
        </label>
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
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Groups
        </label>
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
                className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
              <div className="border border-gray-300 rounded-lg p-3 max-h-64 overflow-auto">
                {!groups || groups.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No groups found. Sync from the Groups page first.
                  </p>
                ) : (
                  groups
                    .filter((g) =>
                      g.name.toLowerCase().includes(groupFilter.toLowerCase())
                    )
                    .map((g) => (
                      <label
                        key={g.id}
                        className="flex items-center gap-3 py-2 px-2 hover:bg-gray-50 rounded-lg cursor-pointer transition"
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
                          className="w-4 h-4 text-emerald-600 rounded focus:ring-2 focus:ring-emerald-500"
                        />
                        <span className="text-sm text-gray-900">{g.name}</span>
                      </label>
                    ))
                )}
              </div>
            </>
          )}
        />
        {errors.groupIds && (
          <p className="text-red-600 text-xs sm:text-sm mt-2">
            {errors.groupIds.message as string}
          </p>
        )}
      </div>

      <div className="border-t pt-5">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            {...register("runNow")}
            className="w-4 h-4 text-emerald-600 rounded focus:ring-2 focus:ring-emerald-500"
          />
          <span className="text-sm sm:text-base text-gray-700">
            Send immediately, then continue scheduled runs
          </span>
        </label>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          disabled={isSubmitting}
          className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6 py-2.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition text-sm sm:text-base"
        >
          {isSubmitting ? "Saving…" : "Save schedule"}
        </button>
        <button
          type="button"
          onClick={() => nav("/schedules")}
          className="flex-1 sm:flex-none border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium px-6 py-2.5 rounded-lg transition text-sm sm:text-base"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
