"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [businessId, setBusinessId] = useState("");
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: biz } = await supabase
        .from("businesses")
        .select("id, name, timezone")
        .eq("owner_id", user.id)
        .single();
      if (biz) {
        setBusinessId(biz.id);
        setName(biz.name);
        setTimezone(biz.timezone);
      }
    }
    load();
  }, [supabase]);

  async function handleSave() {
    setLoading(true);
    const { error } = await supabase
      .from("businesses")
      .update({ name, timezone })
      .eq("id", businessId);
    setLoading(false);
    if (error) {
      toast.error("Save failed. Try again.");
    } else {
      toast.success("Settings saved");
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div>
      <PageHeader title="Settings" />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-sm">Business details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Business name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Timezone</Label>
            <Input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="h-11"
            />
          </div>
          <Button onClick={handleSave} disabled={loading} className="w-full h-11">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
          </Button>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardContent className="p-4">
          <Button
            variant="outline"
            className="w-full h-11"
            onClick={handleSignOut}
          >
            Sign out
          </Button>
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-sm text-red-600 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Danger zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-gray-500">
            Deleting your account is permanent and cannot be undone. All
            inventory data, suppliers, and scan history will be lost.
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs text-red-600">
              Type &quot;DELETE&quot; to confirm
            </Label>
            <Input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              className="h-10 border-red-200 focus:border-red-400"
            />
          </div>
          <Button
            variant="destructive"
            className="w-full h-10"
            disabled={deleteConfirm !== "DELETE"}
            onClick={() => toast.error("Contact support to delete your account.")}
          >
            Delete account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
