"use client";

import { useEffect, useState } from "react";
import { CircleAlertIcon } from "lucide-react";

import { ReviewAccess, type ReviewOutcome } from "@/components/review-access";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

type Role = "member" | "manager" | "owner";

const roleLabels: Record<Role, string> = { member: "Member", manager: "Manager", owner: "Owner" };

type Plan = {
  workspaceEmail: string;
  saved: boolean;
  unavailable: boolean;
  groups: Array<{ id: string; email: string; name: string }>;
  selected: Array<{ groupId: string; groupEmail: string; role: Role; manageable: boolean }>;
};

type State = { status: "loading" } | { status: "ready"; plan: Plan } | { status: ReviewOutcome };

type Errors = Partial<Record<"workspaceEmail" | "groups" | "form", string>>;

type Result = Plan & { outcome?: ReviewOutcome; errors?: Errors };

async function call(id: string, init?: RequestInit) {
  try {
    const response = await fetch(`/api/review/requests/${encodeURIComponent(id)}/plan`, {
      cache: "no-store",
      ...init,
    });
    const result = (await response.json()) as Result;
    return { ok: response.ok, result };
  } catch {
    return { ok: false, result: { outcome: "unavailable" } as Result };
  }
}

function rolesOf(plan: Plan) {
  return Object.fromEntries(plan.selected.map((group) => [group.groupId, group.role]));
}

export function ReviewPlan({
  id,
  workspaceEmail,
  emailSaved,
}: {
  id: string;
  workspaceEmail: string;
  emailSaved: boolean;
}) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [roles, setRoles] = useState<Record<string, Role>>({});
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);

  function apply(plan: Plan) {
    setState({ status: "ready", plan });
    setRoles(rolesOf(plan));
    setErrors({});
  }

  async function load() {
    setState({ status: "loading" });
    const { ok, result } = await call(id);
    if (ok) apply(result);
    else setState({ status: result.outcome ?? "unavailable" });
  }

  useEffect(() => {
    let active = true;
    void call(id).then(({ ok, result }) => {
      if (!active) return;
      if (ok) apply(result);
      else setState({ status: result.outcome ?? "unavailable" });
    });
    return () => {
      active = false;
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- apply only sets state
  }, [id]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    const { ok, result } = await call(id, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceEmail,
        groups: Object.entries(roles).map(([groupId, role]) => ({ id: groupId, role })),
      }),
    });
    setPending(false);
    if (ok) return apply(result);
    if (result.errors) return setErrors(result.errors);
    if (result.outcome) return setState({ status: result.outcome });
    setErrors({ form: "The plan could not be saved. Please try again." });
  }

  if (state.status === "loading")
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Spinner /> Loading Workspace plan
      </div>
    );
  if (state.status !== "ready")
    return <ReviewAccess outcome={state.status} retry={() => void load()} />;

  const { plan } = state;
  const stale = plan.selected.filter((group) => !group.manageable && group.groupId in roles);

  return (
    <div className="flex flex-col gap-5">
      <form noValidate onSubmit={save}>
        <FieldSet disabled={pending}>
          <FieldLegend>Workspace account plan</FieldLegend>
          <FieldGroup>
            <FieldSet data-invalid={Boolean(errors.groups)}>
              <FieldLegend variant="label">Initial groups</FieldLegend>
              <FieldDescription>
                Optional. Only groups you can manage are listed; each defaults to member.
              </FieldDescription>
              {plan.groups.length === 0 && stale.length === 0 && (
                <p className="text-sm text-muted-foreground">No manageable groups are available.</p>
              )}
              {[
                ...plan.groups.map((group) => ({ ...group, manageable: true })),
                ...stale.map((group) => ({
                  id: group.groupId,
                  email: group.groupEmail,
                  name: group.groupEmail,
                  manageable: false,
                })),
              ].map((group) => (
                <Field key={group.id} orientation="horizontal">
                  <Checkbox
                    checked={group.id in roles}
                    id={`group-${group.id}`}
                    onCheckedChange={(checked) =>
                      setRoles((current) => {
                        const { [group.id]: _removed, ...rest } = current;
                        return checked ? { ...rest, [group.id]: "member" } : rest;
                      })
                    }
                  />
                  <FieldLabel htmlFor={`group-${group.id}`}>
                    <span className="flex flex-col">
                      {group.name}
                      <span className="font-normal text-muted-foreground">{group.email}</span>
                    </span>
                    {!group.manageable && <Badge variant="destructive">No longer manageable</Badge>}
                  </FieldLabel>
                  <Select
                    disabled={!(group.id in roles)}
                    items={roleLabels}
                    onValueChange={(role) =>
                      role && setRoles((current) => ({ ...current, [group.id]: role as Role }))
                    }
                    value={roles[group.id] ?? "member"}
                  >
                    <SelectTrigger aria-label={`Role in ${group.name}`} className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(roleLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ))}
              <FieldError>{errors.groups}</FieldError>
            </FieldSet>
            {stale.length > 0 && (
              <Alert variant="destructive">
                <CircleAlertIcon />
                <AlertTitle>A saved group needs revision</AlertTitle>
                <AlertDescription>
                  Remove the group you can no longer manage before saving this plan.
                </AlertDescription>
              </Alert>
            )}
            <FieldError>{errors.workspaceEmail ?? errors.form}</FieldError>
            <div>
              <Button disabled={pending} type="submit">
                {pending && <Spinner data-icon="inline-start" />}
                Save plan
              </Button>
            </div>
          </FieldGroup>
        </FieldSet>
      </form>

      <section aria-labelledby="final-review" className="flex flex-col gap-2 rounded-lg border p-4">
        <h2 className="font-heading text-base font-medium" id="final-review">
          Final review
        </h2>
        <p className="flex items-center gap-2 text-sm">
          Workspace email: <strong>{workspaceEmail || "Not set"}</strong>
          {!(emailSaved || plan.saved) && <Badge variant="outline">Not saved</Badge>}
        </p>
        {plan.selected.length === 0 ? (
          <p className="text-sm">No initial groups saved.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {plan.selected.map((group) => (
              <li className="flex items-center gap-2" key={group.groupId}>
                {group.groupEmail}
                <Badge variant={group.role === "member" ? "secondary" : "default"}>
                  {roleLabels[group.role]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-muted-foreground">
          Group roles and notification-group delivery only control Google Group access. They do not
          grant administrative authority. Nothing is created until a request is accepted.
        </p>
      </section>
    </div>
  );
}
