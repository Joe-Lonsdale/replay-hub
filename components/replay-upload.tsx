"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { uploadReplayFile } from "@/lib/replay/upload-client";

interface Item {
  name: string;
  status: string;
  ok: boolean | null;
}

export function ReplayUpload() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  async function take(list: FileList | File[]) {
    const files = [...list].filter((file) => file.name.toLowerCase().endsWith(".replay"));
    if (!files.length) {
      setItems([{ name: "Nothing to upload", status: "Choose one or more .replay files.", ok: false }]);
      return;
    }
    setBusy(true);
    const next: Item[] = files.map((file) => ({ name: file.name, status: "Waiting", ok: null }));
    setItems(next);
    for (let index = 0; index < files.length; index += 1) {
      try {
        const status = await uploadReplayFile(files[index], (text) => {
          next[index] = { ...next[index], status: text, ok: null };
          setItems([...next]);
        });
        next[index] = { name: files[index].name, status, ok: true };
      } catch (error) {
        next[index] = {
          name: files[index].name,
          status: error instanceof Error ? error.message : "Upload failed",
          ok: false,
        };
      }
      setItems([...next]);
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <section
      className={`border bg-panel p-4 ${over ? "border-gold" : "border-line"}`}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        if (!busy) void take(event.dataTransfer.files);
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl tracking-tight">Upload replays</h2>
          <p className="mt-1 text-sm text-muted">
            Drop .replay files here. They are read in this browser, then the stats and the file are saved.
          </p>
        </div>
        <label className={`bg-gold px-3 py-1.5 text-sm text-bg ${busy ? "opacity-60" : "cursor-pointer"}`}>
          {busy ? "Uploading" : "Choose files"}
          <input
            className="sr-only"
            type="file"
            accept=".replay"
            multiple
            disabled={busy}
            onChange={(event) => {
              const files = event.target.files;
              if (files?.length) void take(files);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      {items.length ? (
        <ul className="mt-4 space-y-2 text-sm">
          {items.map((item, index) => (
            <li key={`${item.name}-${index}`} className="border-t border-line pt-2">
              <span className="font-mono">{item.name}</span>
              <span className={item.ok === false ? "text-loss" : item.ok ? "text-win" : "text-muted"}>
                {" "}
                {item.status}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
