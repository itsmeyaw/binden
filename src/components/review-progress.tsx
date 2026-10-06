import {
  CheckCircle2Icon,
  CircleAlertIcon,
  CircleDashedIcon,
  LoaderCircleIcon,
} from "lucide-react";

import { roleLabels, type Role } from "@/components/review-plan";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export type Progress = {
  status: "accepted" | "provisioning" | "awaiting_handover";
  workspaceEmail: string | null;
  acceptedAt: string | null;
  accountCreateState: "not_started" | "attempting" | "created" | "uncertain";
  groups: Array<{
    groupId: string;
    groupEmail: string;
    role: Role;
    state: "pending" | "added" | "failed";
  }>;
};

export const statusLabels: Record<Progress["status"], string> = {
  accepted: "Accepted",
  provisioning: "Provisioning",
  awaiting_handover: "Awaiting handover",
};

const groupStates = { pending: "Pending", added: "Added", failed: "Failed" } as const;

export function ReviewProgress({ name, progress }: { name: string; progress: Progress }) {
  const uncertain = progress.accountCreateState === "uncertain";
  const failed = progress.groups.some((group) => group.state === "failed");
  const done = progress.status === "awaiting_handover";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-heading text-lg font-medium">{name}</h2>
        <p className="text-sm text-muted-foreground">{progress.workspaceEmail}</p>
      </div>
      <ol className="flex flex-col gap-4">
        <li className="flex gap-3">
          <CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-2 font-medium">
              Accepted <Badge variant="secondary">Done</Badge>
            </span>
            <span className="text-sm text-muted-foreground">
              The chosen Workspace email and memberships are recorded. Acceptance authorizes
              provisioning; it does not create the account.
            </span>
          </div>
        </li>
        <li className="flex gap-3">
          {done ? (
            <CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-primary" />
          ) : uncertain || failed ? (
            <CircleAlertIcon className="mt-0.5 size-5 shrink-0 text-destructive" />
          ) : (
            <LoaderCircleIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          )}
          <div className="flex flex-col gap-2">
            <span className="flex items-center gap-2 font-medium">
              Provisioning
              <Badge variant={done ? "secondary" : uncertain || failed ? "destructive" : "outline"}>
                {done ? "Complete" : uncertain || failed ? "Needs attention" : "In progress"}
              </Badge>
            </span>
            {uncertain && (
              <Alert variant="destructive">
                <CircleAlertIcon />
                <AlertTitle>Account creation outcome unknown</AlertTitle>
                <AlertDescription>
                  Google did not confirm whether the account was created. It will not be created
                  again until the outcome has been reconciled with Google.
                </AlertDescription>
              </Alert>
            )}
            {progress.accountCreateState === "attempting" && (
              <span className="text-sm">Creating the Workspace account</span>
            )}
            {progress.accountCreateState === "created" && (
              <span className="text-sm">Workspace account created</span>
            )}
            {failed && (
              <span className="text-sm text-destructive">
                Some memberships could not be added. Successful ones are kept.
              </span>
            )}
            {progress.groups.length > 0 && progress.accountCreateState !== "uncertain" && (
              <ul className="flex flex-col gap-1 text-sm">
                {progress.groups.map((group) => (
                  <li className="flex items-center gap-2" key={group.groupId}>
                    {group.groupEmail} · {roleLabels[group.role]}
                    <Badge variant={group.state === "failed" ? "destructive" : "outline"}>
                      {groupStates[group.state]}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </li>
        <li className="flex gap-3">
          <CircleDashedIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-2 font-medium">
              Account handover{" "}
              <Badge variant="outline">{done ? "Awaiting handover" : "Not started"}</Badge>
            </span>
            <span className="text-sm text-muted-foreground">
              {done
                ? "Provisioning is complete. First-login instructions have not been sent yet."
                : "Available once provisioning completes."}
            </span>
          </div>
        </li>
      </ol>
    </div>
  );
}
