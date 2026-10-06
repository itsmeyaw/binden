import { CircleAlertIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type Role = "member" | "manager" | "owner";

export const roleLabels: Record<Role, string> = {
  member: "Member",
  manager: "Manager",
  owner: "Owner",
};

export type Plan = {
  workspaceEmail: string;
  saved: boolean;
  unavailable: boolean;
  groups: Array<{ id: string; email: string; name: string }>;
  selected: Array<{ groupId: string; groupEmail: string; role: Role; manageable: boolean }>;
};

export function ReviewPlan({
  disabled,
  errors,
  plan,
  roles,
  setRoles,
}: {
  disabled?: boolean;
  errors?: string;
  plan: Plan;
  roles: Record<string, Role>;
  setRoles: React.Dispatch<React.SetStateAction<Record<string, Role>>>;
}) {
  const stale = plan.selected.filter((group) => !group.manageable && group.groupId in roles);

  return (
    <FieldSet data-invalid={Boolean(errors)}>
      <FieldLegend>Group Assignment</FieldLegend>
      <FieldGroup>
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
              // A disabled role select must not dim its own checkbox while editing.
              className={disabled ? undefined : "group-has-disabled/field:opacity-100"}
              disabled={disabled}
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
              disabled={disabled || !(group.id in roles)}
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
                <SelectGroup>
                  {Object.entries(roleLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        ))}
        <FieldError>{errors}</FieldError>
        {stale.length > 0 && (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>A saved group needs revision</AlertTitle>
            <AlertDescription>
              Remove the group you can no longer manage before saving this plan.
            </AlertDescription>
          </Alert>
        )}
      </FieldGroup>
    </FieldSet>
  );
}
