import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import toast from "react-hot-toast";
import TimezoneSelect from "react-timezone-select";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import { api } from "../lib/api";
import { SCHEDULE_FORM_UI_TEXT } from "../lib/constants";
import {
  CronBuilder,
  MIN_CRON_INTERVAL_MINUTES,
  violatesMinCronInterval
} from "../components/CronBuilder";
import { Button } from "../components/ui/Button";
import { Label } from "../components/ui/Label";

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
      toast.error(SCHEDULE_FORM_UI_TEXT.maxImagesError);
    }

    const nonImages = next.filter((f) => !f.type.startsWith("image/"));
    if (nonImages.length) {
      toast.error(SCHEDULE_FORM_UI_TEXT.imagesOnlyError);
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
      toast.success(SCHEDULE_FORM_UI_TEXT.saveSuccess);
      nav("/schedules");
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || SCHEDULE_FORM_UI_TEXT.saveFailed
      );
    }
  }

  return (
    <div className="max-w-2xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold">
            {isEdit ? "Edit schedule" : "New schedule"}
          </h2>
        </div>

        <div className="space-y-2">
          <Label htmlFor="messageText">Message text</Label>
          <div className="relative">
            <textarea
              id="messageText"
              {...register("messageText")}
              rows={5}
              placeholder="Enter the message you want to send"
              className="w-full border border-input rounded-md px-4 py-3 text-sm focus:ring-2 focus:ring-ring focus:border-transparent transition resize-vertical bg-background"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="absolute right-3 bottom-3"
              onClick={() => setShowEmojiPicker((s) => !s)}
            >
              😀 Emoji
            </Button>
            {showEmojiPicker && (
              <div
                className="absolute right-0 mt-2 z-20 border border-border rounded-lg shadow-lg bg-background"
                style={{ maxHeight: "400px", overflowY: "auto" }}
              >
                <EmojiPicker onEmojiClick={onEmojiClick} />
              </div>
            )}
          </div>
          {errors.messageText && (
            <p className="text-sm text-destructive">
              {errors.messageText.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="images">Images (up to 5)</Label>
          <input
            id="images"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              onSelectImages(e.target.files);
              e.currentTarget.value = "";
            }}
            className="block w-full text-sm border border-input rounded-md px-4 py-2 focus:ring-2 focus:ring-ring focus:border-transparent transition bg-background"
          />

          {(imageUrls.length > 0 || filePreviews.length > 0) && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {imageUrls.map((url) => (
                <div
                  key={url}
                  className="relative border-2 border-border rounded-lg overflow-hidden group hover:border-primary transition"
                >
                  <img
                    src={url}
                    alt="Schedule attachment"
                    className="w-full h-24 sm:h-28 object-cover"
                  />
                  <Button
                    type="button"
                    onClick={() => removeExistingImage(url)}
                    variant="ghost"
                    size="sm"
                    className="absolute top-1 right-1 bg-background border border-border hover:bg-destructive hover:text-destructive-foreground rounded-md px-2 py-1 text-xs font-medium opacity-0 group-hover:opacity-100 transition"
                  >
                    ✕
                  </Button>
                </div>
              ))}

              {filePreviews.map((file, idx) => (
                <div
                  key={`${file.name}-${idx}`}
                  className="relative border-2 border-dashed border-primary rounded-lg overflow-hidden group hover:border-primary transition"
                >
                  <img
                    src={file.url}
                    alt={file.name}
                    className="w-full h-24 sm:h-28 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeSelectedFile(idx)}
                    className="absolute top-1 right-1 bg-background border border-border hover:bg-destructive hover:text-destructive-foreground rounded-md px-2 py-1 text-xs font-medium opacity-0 group-hover:opacity-100 transition"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Schedule</Label>
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

        <div className="space-y-2">
          <Label>Timezone</Label>
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

        <div className="space-y-2">
          <Label htmlFor="groupSearch">Groups ({groups?.length ?? 0})</Label>
          <p className="text-xs text-muted-foreground">
            If you can&apos;t find a group, Sync groups first at page{" "}
            <Link to="/groups" className="underline underline-offset-2">
              <b>Groups</b>
            </Link>
            .
          </p>
          <Controller
            name="groupIds"
            control={control}
            render={({ field }) => (
              <>
                <input
                  id="groupSearch"
                  type="text"
                  placeholder="Search groups..."
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                  className="w-full border border-input rounded-md px-4 py-2 text-sm focus:ring-2 focus:ring-ring focus:border-transparent transition bg-background"
                />
                <div className="border border-input rounded-md p-3 max-h-64 overflow-auto">
                  {!groups || groups.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
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
                          className="flex items-center gap-3 py-2 px-2 hover:bg-muted rounded-md cursor-pointer transition"
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
                            className="w-4 h-4 rounded focus:ring-2 focus:ring-ring"
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
            <p className="text-sm text-destructive">
              {errors.groupIds.message as string}
            </p>
          )}
        </div>

        <div className="border-t pt-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              {...register("runNow")}
              className="w-4 h-4 rounded focus:ring-2 focus:ring-ring"
            />
            <span className="text-sm font-medium">
              Send immediately, then continue scheduled runs
            </span>
          </label>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Button type="submit" disabled={isSubmitting} size="lg">
            {isSubmitting ? "Saving…" : "Save schedule"}
          </Button>
          <Button
            type="button"
            onClick={() => nav("/schedules")}
            variant="outline"
            size="lg"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
