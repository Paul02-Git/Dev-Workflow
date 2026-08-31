"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { createClientAction } from "@/lib/actions";

export function CreateClientForm() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Create client</Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New client</DialogTitle>
            <DialogDescription>Add a client to start a project or maintenance plan for them.</DialogDescription>
          </DialogHeader>
          <form
            action={async (formData) => {
              await createClientAction(formData);
              setOpen(false);
            }}
            className="grid grid-cols-2 gap-3"
          >
            <input
              name="name"
              placeholder="Client / contact name *"
              required
              className="col-span-2 rounded-md border border-black/15 px-3 py-2 text-sm sm:col-span-1"
            />
            <input name="company" placeholder="Company" className="rounded-md border border-black/15 px-3 py-2 text-sm" />
            <input
              name="contactEmail"
              type="email"
              placeholder="Email"
              className="rounded-md border border-black/15 px-3 py-2 text-sm"
            />
            <input
              name="contactPhone"
              placeholder="Phone"
              className="rounded-md border border-black/15 px-3 py-2 text-sm"
            />
            <Button type="submit" className="col-span-2 mt-1 w-fit sm:col-span-1">
              Add client
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
