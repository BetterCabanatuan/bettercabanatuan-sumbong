# BetterCabanatuan Community Issue Reporter

A volunteer-run civic tool under the BetterCabanatuan initiative where residents of Cabanatuan City report problems in public spaces (potholes, leaning poles, clogged drainage, uncollected garbage) so they become visible and reach the office responsible for fixing them. It is independent of the City Government: offices never log in; Volunteers carry Reports to them.

## Language

### Reporting

**Report**:
A single resident's submission describing one problem at one location. Shown as "Sumbong" in the Filipino UI. Two people reporting the same pothole produce two independent Reports.
_Avoid_: Sumbong (in code/docs), Issue, Ticket, Complaint, Service Request, Concern

**Reporter**:
The resident who submitted a Report, with or without an account. Their identity is never shown publicly.
_Avoid_: User, Citizen, Complainant

**Tracking Link**:
The private link a Reporter gets after submitting, or the signed link in a notification email. It lets them see their Report before Review, add an email and reopen it. It is not an account.
_Avoid_: Ticket number, Magic link

**Category**:
The kind of problem a Report describes, such as Roads & Potholes or Poles & Wires. Volunteers manage the list; it is not fixed.
_Avoid_: Type, Service, Topic

**Category Question**:
An extra question a Category asks the Reporter, such as "Electric or telecom pole?" for Poles & Wires.
_Avoid_: Custom field, Attribute

**Suggested Office**:
The Responsible Office the system proposes for a Report from its Category and location. A Volunteer confirms or overrides it during Review.
_Avoid_: Auto-route, Assignment

**Me Too**:
A resident's confirmation that a published Report's problem also affects them, shown as "Ako rin". It is not a Report and has no status of its own.
_Avoid_: Upvote, Vote, Like, +1

**Duplicate**:
A Report a Volunteer has linked to an earlier Report about the same problem, called its Original. Digests list the Original once, with a count.
_Avoid_: Merged report, Child report

**Review**:
The Volunteer check that a Report must pass before it becomes public: correct location and Category, faces and plate numbers blurred, no accusations against named people.
_Avoid_: Approval, Moderation queue

**Follower**:
A Reporter who left an account, an email address or a push subscription so they can be told when their Report's status changes.
_Avoid_: Subscriber

**Barangay**:
The barangay of Cabanatuan City whose territory contains a Report's location. It is tagged automatically, and a Report outside city limits cannot be submitted.
_Avoid_: District, Zone, Area

### Forwarding

**Volunteer**:
A BetterCabanatuan member who reviews Reports and carries them to Responsible Offices.
_Avoid_: Admin, Moderator, Staff, Agent

**Coordinator**:
A Volunteer who also manages Categories, Responsible Offices and who is a Volunteer. Volunteers join by invitation only.
_Avoid_: Admin, Superuser, Owner

**Responsible Office**:
The body that owns the thing being reported and can fix it, such as CELCOR (electric poles), the City Engineer's Office (city roads, drainage, streetlights), DPWH (national roads), a barangay (barangay roads, biodegradable waste) or City ENRO (residual waste).
_Avoid_: Agency, Department, Organization, LGU

**Digest**:
A periodic batch of Reports a Volunteer sends to one Responsible Office through that office's official channel (letter, text line, email). It takes the form of a generated letter, and a Digest counts as sent only once a Volunteer logs when and how it went out.
_Avoid_: Referral, Escalation, Ticket export

**Proof of Receipt**:
Optional evidence that a Responsible Office received a Digest, such as a photo of the "received" stamp on the letter.
_Avoid_: Acknowledgement, Receipt

**Scorecard**:
Public, neutral statistics for one Responsible Office: Reports forwarded, Reports resolved and median days from first Forwarded to final Resolved. A Reopened Report keeps its clock running. Delays before forwarding and Misroutes never count against the office. No rankings.

**Misroute**:
A Forwarded Report the receiving office says is not theirs. A Volunteer reassigns it to the correct Responsible Office, and it returns to Published for that office's next Digest.
_Avoid_: Wrong office, Transfer, Bounce
_Avoid_: Leaderboard, Ranking, Report card

### Report status

**Pending Review**: Submitted, visible only to Volunteers and its Reporter.
**Rejected**: Failed Review (out of bounds, abusive, not a public-space problem). Never public.
**Published**: Passed Review; public on the map and waiting for the next Digest.
**Forwarded**: Included in a Digest sent to its Responsible Office.
**Resolved**: A Volunteer judged it fixed, ideally with an "after" photo. Its Followers are notified.
**Reopened**: Within 30 days of Resolved, a Follower said the Report is not actually fixed. It goes into the next Digest again.

A Duplicate always takes its Original's status.
_Avoid_: Open, Closed, In Progress, Done
