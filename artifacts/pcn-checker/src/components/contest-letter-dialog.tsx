import { useState, useMemo, type ReactNode } from "react";
import { format } from "date-fns";
import { Copy, Download, FileText, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { PCN } from "@/hooks/use-pcns";

const CONTEST_GROUNDS = [
  {
    id: "no_contravention",
    label: "The contravention did not occur",
    description:
      "The alleged offence did not take place. There is no evidence that a contravention occurred.",
    letterText:
      "The contravention alleged in the Notice did not occur. I was not in breach of the relevant restriction at the time stated.",
  },
  {
    id: "signs_unclear",
    label: "Signs or road markings were absent, obscured or defective",
    description:
      "The relevant traffic signs or road markings were not in place, were obscured, or were not clearly visible.",
    letterText:
      "The traffic signs and/or road markings relevant to the alleged contravention were absent, obscured, or in a defective state, and therefore insufficient to put a driver on notice of the restriction.",
  },
  {
    id: "grace_period",
    label: "A grace period was not observed",
    description:
      "The vehicle was not given the minimum required grace period before the notice was issued.",
    letterText:
      "The Civil Enforcement Officer failed to observe the required grace period before issuing the Penalty Charge Notice, contrary to the relevant statutory guidance.",
  },
  {
    id: "excessive_charge",
    label: "The penalty charge exceeds the relevant amount",
    description:
      "The charge amount is incorrect or exceeds the statutory cap set by the relevant authority.",
    letterText:
      "The penalty charge specified in the Notice exceeds the relevant amount prescribed by the applicable statutory instrument for this class of contravention.",
  },
  {
    id: "breakdown_emergency",
    label: "Vehicle stationary due to breakdown or genuine emergency",
    description:
      "The driver was unable to move the vehicle due to mechanical failure or a sudden emergency.",
    letterText:
      "At the time of the alleged contravention the vehicle was stationary due to a genuine mechanical breakdown/emergency that was beyond the driver's control. Steps were taken to resolve the situation as quickly as possible.",
  },
  {
    id: "stolen",
    label: "The vehicle had been taken without consent (stolen)",
    description:
      "The vehicle was stolen at the time of the contravention and was not being used with the owner's permission.",
    letterText:
      "At the time of the alleged contravention, the vehicle had been taken without the owner's consent. A report was made to the police, and I have documentary evidence of this available upon request.",
  },
  {
    id: "sold",
    label: "The vehicle had been sold before the contravention date",
    description:
      "Ownership of the vehicle had transferred to another person before the alleged offence occurred.",
    letterText:
      "The vehicle had been sold and ownership transferred to another party before the date of the alleged contravention. I was no longer the registered keeper or owner at the relevant time.",
  },
  {
    id: "exempt",
    label: "The vehicle or driver is exempt from the restriction",
    description:
      "The vehicle or the person driving it qualifies for a statutory or local exemption from the restriction.",
    letterText:
      "The vehicle and/or driver is exempt from the restriction to which the alleged contravention relates. Evidence of this exemption is available upon request.",
  },
  {
    id: "procedural_error",
    label: "Procedural irregularity in the issue of the notice",
    description:
      "The PCN was not served correctly, contains errors, or the required procedure was not followed.",
    letterText:
      "The Penalty Charge Notice contains a material procedural irregularity or error and was not served in accordance with the applicable statutory requirements, rendering it invalid.",
  },
] as const;

type GroundId = (typeof CONTEST_GROUNDS)[number]["id"];

interface ContestLetterDialogProps {
  pcn: PCN;
  vehicleRegistration?: string;
  userEmail?: string;
  onContested?: () => void;
  /** Optional custom trigger; falls back to the default "Contest Letter" button. */
  trigger?: ReactNode;
}

function generateLetter(
  pcn: PCN,
  selectedGrounds: GroundId[],
  additionalDetails: string,
  vehicleRegistration?: string,
  userEmail?: string
): string {
  const today = format(new Date(), "d MMMM yyyy");
  const issueDate = pcn.issue_date
    ? format(new Date(pcn.issue_date), "d MMMM yyyy")
    : "the date shown on the Notice";
  const vehicleRef = vehicleRegistration || "the vehicle";
  const location = pcn.location || "the location stated in the Notice";

  const groundsText = selectedGrounds
    .map((id, idx) => {
      const ground = CONTEST_GROUNDS.find((g) => g.id === id)!;
      return `${idx + 1}. ${ground.letterText}`;
    })
    .join("\n\n");

  const additionalSection = additionalDetails.trim()
    ? `\nFurther details in support of this representation:\n\n${additionalDetails.trim()}\n`
    : "";

  return `${userEmail || "[Your Name]"}
${today}

${pcn.issuer}

Re: Formal Representation Against Penalty Charge Notice — ${pcn.pcn_reference}

Dear Sir or Madam,

I am writing to formally represent against the above-mentioned Penalty Charge Notice (reference ${pcn.pcn_reference}), issued on ${issueDate} in respect of ${vehicleRef} at ${location}.

I submit this representation on the following grounds:

${groundsText || "[Please select at least one ground above]"}
${additionalSection}
For the reasons set out above, I respectfully request that this Penalty Charge Notice be cancelled.

Please acknowledge receipt of this representation and issue a Notice of Rejection or Notice of Acceptance within the statutory timeframe. Should you require any supporting documentation or further information, please contact me at the address above.

Yours faithfully,

${userEmail || "[Your Name]"}`;
}

export function ContestLetterDialog({
  pcn,
  vehicleRegistration,
  userEmail,
  onContested,
  trigger,
}: ContestLetterDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedGrounds, setSelectedGrounds] = useState<GroundId[]>([]);
  const [additionalDetails, setAdditionalDetails] = useState("");
  const [showLetter, setShowLetter] = useState(false);

  const letter = useMemo(
    () =>
      generateLetter(
        pcn,
        selectedGrounds,
        additionalDetails,
        vehicleRegistration,
        userEmail
      ),
    [pcn, selectedGrounds, additionalDetails, vehicleRegistration, userEmail]
  );

  function toggleGround(id: GroundId) {
    setSelectedGrounds((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(letter);
      toast({ title: "Copied to clipboard", description: "Letter text copied." });
    } catch {
      toast({
        variant: "destructive",
        title: "Copy failed",
        description: "Please select and copy the text manually.",
      });
    }
  }

  function handleDownload() {
    const blob = new Blob([letter], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contest-${pcn.pcn_reference}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleContestAndClose() {
    onContested?.();
    setOpen(false);
    toast({
      title: "PCN marked as Contested",
      description: "Status updated and your letter is ready to send.",
    });
  }

  const canGenerate = selectedGrounds.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            variant="outline"
            className="bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 border-blue-200"
          >
            <ShieldAlert className="mr-2 h-4 w-4" /> Contest Letter
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="w-[95vw] max-w-4xl p-0 gap-0 max-h-[90vh] flex flex-col">
        {/* Header */}
        <DialogHeader className="px-4 sm:px-6 pt-5 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <FileText className="h-5 w-5 text-blue-600 shrink-0" />
            Generate Contest Letter
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Select your grounds and generate a formal representation letter for{" "}
            <strong>{pcn.pcn_reference}</strong>.
          </DialogDescription>
        </DialogHeader>

        {/* Mobile tab switcher */}
        <div className="md:hidden flex border-b shrink-0">
          <button
            onClick={() => setShowLetter(false)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              !showLetter
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground"
            }`}
          >
            1. Choose Grounds
          </button>
          <button
            onClick={() => setShowLetter(true)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              showLetter
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground"
            }`}
          >
            2. Your Letter
          </button>
        </div>

        {/* Body — two panels on desktop, tabbed on mobile */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Left: grounds selector */}
          <div
            className={`flex flex-col w-full md:w-1/2 md:border-r min-h-0 ${
              showLetter ? "hidden md:flex" : "flex"
            }`}
          >
            <div className="hidden md:block px-6 py-3 border-b bg-muted/30 shrink-0">
              <p className="text-sm font-medium">Select grounds for representation</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Choose all that apply
              </p>
            </div>
            <ScrollArea className="flex-1">
              <div className="px-4 sm:px-6 py-4 space-y-3">
                {CONTEST_GROUNDS.map((ground) => {
                  const checked = selectedGrounds.includes(ground.id);
                  return (
                    <div
                      key={ground.id}
                      className={`flex gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        checked
                          ? "border-blue-300 bg-blue-50"
                          : "border-border hover:bg-muted/50"
                      }`}
                      onClick={() => toggleGround(ground.id)}
                    >
                      <Checkbox
                        id={ground.id}
                        checked={checked}
                        onCheckedChange={() => toggleGround(ground.id)}
                        className="mt-0.5 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div>
                        <Label
                          htmlFor={ground.id}
                          className="text-sm font-medium cursor-pointer leading-snug"
                        >
                          {ground.label}
                        </Label>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          {ground.description}
                        </p>
                      </div>
                    </div>
                  );
                })}

                <Separator />

                <div className="space-y-2 pb-2">
                  <Label htmlFor="additional-details" className="text-sm font-medium">
                    Additional details{" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Textarea
                    id="additional-details"
                    placeholder="Any specific circumstances, evidence, or witness information…"
                    value={additionalDetails}
                    onChange={(e) => setAdditionalDetails(e.target.value)}
                    rows={3}
                    className="resize-none text-sm"
                  />
                </div>

                {/* Mobile: preview button */}
                <div className="md:hidden pt-1">
                  <Button
                    className="w-full"
                    disabled={!canGenerate}
                    onClick={() => setShowLetter(true)}
                  >
                    Preview Letter →
                  </Button>
                </div>
              </div>
            </ScrollArea>
          </div>

          {/* Right: letter preview */}
          <div
            className={`flex flex-col w-full md:w-1/2 min-h-0 ${
              showLetter ? "flex" : "hidden md:flex"
            }`}
          >
            <div className="px-4 sm:px-6 py-3 border-b bg-muted/30 shrink-0 flex items-center justify-between">
              <div className="hidden md:block">
                <p className="text-sm font-medium">Your letter</p>
                <p className="text-xs text-muted-foreground">Updates as you select grounds</p>
              </div>
              <div className="flex gap-2 w-full md:w-auto justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  disabled={!canGenerate}
                >
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  disabled={!canGenerate}
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" /> .txt
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <pre className="px-4 sm:px-6 py-4 text-xs font-mono whitespace-pre-wrap leading-relaxed text-foreground/90">
                {letter}
              </pre>
            </ScrollArea>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-4 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-muted/20 shrink-0">
          <p className="text-xs text-muted-foreground">
            Review carefully before sending. For complex cases, consult a legal advisor.
          </p>
          <div className="flex gap-2 w-full sm:w-auto justify-end shrink-0">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            {pcn.status !== "contested" && (
              <Button
                onClick={handleContestAndClose}
                disabled={!canGenerate}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <ShieldAlert className="mr-2 h-4 w-4" />
                Mark as Contested
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
