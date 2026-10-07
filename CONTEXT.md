# Workspace User Management

The nonprofit's onboarding, self-service, and administration of its Google Workspace users and groups.

## Language

**Applicant**:
A person requesting a Workspace account who has not yet received one through onboarding.
_Avoid_: User, pending user

**Signup request**:
An applicant's request for a Workspace account, containing submitted information that an administrator may correct before acceptance or rejection.
_Avoid_: Account, pending user

**Acceptance**:
An administrator's approval of a signup request, including its chosen Workspace email and initial group memberships. Acceptance authorizes provisioning but does not mean provisioning or account handover is complete.

**Rejection**:
An administrator's decision to decline a signup request, accompanied by an applicant-facing reason. Rejection does not prevent a fresh signup request.

**Provisioning**:
Creation of a Workspace account and establishment of all initial group memberships selected by the reviewing administrator for an accepted signup request.

**Workspace user**:
A person with a managed Google account in the nonprofit's Workspace organization.
_Avoid_: Applicant

**Administrator**:
A Workspace user whose Google Workspace administrative privileges authorize the relevant management action.
_Avoid_: App administrator

**Acting administrator**:
The signed-in Administrator whose own OAuth grant makes every Directory call. No shared or stronger credential is ever used, and a denied call is reported rather than retried.

**Manageable group**:
A Group the acting administrator can write to. Google ties group writes to admin role privileges rather than to individual groups, so this is every Group for a super administrator or a holder of a role with the Groups privilege, and none otherwise.

**Contact email**:
An email address used to contact a person, distinct from their managed Workspace email address.

**Applicant-verified contact email**:
A contact email whose ownership the applicant has demonstrated during signup.

**Administrator-confirmed contact email**:
A corrected signup-request contact email confirmed by an authorized administrator without requiring the applicant to verify the replacement address.

**Workspace email**:
The primary email address of a person's managed Google Workspace account.

**Self-service**:
A Workspace user's submission of changes to their own contact information for administrator approval.

**Profile change request**:
A Workspace user's proposed contact email or phone changes awaiting approval together by an administrator with sufficient privileges. Each user has at most one pending request; a new submission replaces it.
_Avoid_: Profile update

**Account handover**:
Sending first-login instructions to an approved applicant after provisioning is complete, explicitly confirmed by an administrator. Confirmation means the instructions were sent, not that the applicant has signed in.

**Suspension**:
Reversible deactivation of a Workspace account that retains the account and its data.
_Avoid_: Deletion, deactivation

**Deletion**:
Removal of a Workspace account after the organization has resolved the disposition of its data.
_Avoid_: Suspension, deactivation

**Group**:
A Google Group within the nonprofit's Workspace organization.

**Group membership**:
A Workspace user's relationship to a group, with a member, manager, or owner role.

**Group manager**:
A group member with Google's manager role in that group; this role does not itself confer application administrator authority.

**Group owner**:
A group member with Google's owner role in that group; this role does not itself confer application administrator authority.

**Initial group membership**:
A group membership explicitly selected by the reviewing administrator during onboarding, with no automatic assignments. Its role is member unless manager or owner is explicitly selected.
