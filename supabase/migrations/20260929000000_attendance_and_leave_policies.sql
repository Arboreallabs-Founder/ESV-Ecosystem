-- The two signed HR policy documents, imported into the HR Zone.
--
-- Source: the PDFs HR circulated — "Attendance and Working Hours Policy" (final, 03-09-2026) and
-- "Leave Policy". Both are transcribed, not rewritten. Where the source documents contradict
-- themselves the contradiction is carried over verbatim rather than quietly resolved, because a
-- policy is the company's word and an import is not the place to change it:
--
--   * Attendance §4 says 9 hours per day; §4.1 says 8 hours excluding breaks; §4.4 says 9 again.
--   * Attendance repeats the numbers 4.1 and 4.2 for two different pairs of clauses. The section
--     numbering here follows that document's own table of contents (1–8), which is the only
--     internally consistent numbering it has.
--   * Leave §6 tabulates 10 festival/public holidays, §7 says 12, and the annexed list names 15.
--
-- These are flagged for HR to correct in the app's editor — the reader renders whatever the body
-- says, so a fix is an edit, not another migration.
--
-- Body format is the Markdown subset that src/lib/policy-doc.ts parses (## / ### / #### headings,
-- - and 1. lists with one level of nesting, | tables |, > callouts, **bold**). created_by is left
-- NULL: no user in this app wrote these.

-- ─── 1. Attendance and Working Hours ────────────────────────────────────────
INSERT INTO public.hr_policies (org_id, title, category, position, body)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Attendance and Working Hours Policy',
  'Attendance',
  0,
  $policy$## 1. Introduction
At Early Seed Ventures, we value discipline, responsibility, and mutual respect. This policy aims to provide a transparent framework for managing attendance, punctuality, and work hour commitments to maintain workplace efficiency and accountability.

## 2. Objective
The objectives of the policy on working hours and attendance at **Early Seed Ventures** are as follows:

- The policy establishes criteria for governing the Company's working hours and attendance.
- Maintaining discipline at **Early Seed Ventures** while adhering to the working hours.
- To ensure that employees report to work on a regular basis, that absences from work are communicated to management in advance, and that their job and that of others are not jeopardized as a result of absence.

## 3. Scope
This policy applies to all full-time, part-time, and contract employees of **Early Seed Ventures**.

## 4. Standard Working Hours
The regular working hours are **9 hours per day, from Monday to Saturday**, with Sunday as the weekly day off.

### 4.1(i) Saturday Work Policy

#### Work Mode
1. One Saturday per month will be Work From Office (WFO).
2. Remaining working Saturdays will be Work From Home (WFH).

### 4.2 Saturday Work Schedule
1. Mandatory Book Call.
2. Saturday working hours: **10:00 a.m. to 5:00 p.m.** (with a grace period of 20 minutes). Beyond this will be a half day and deducted from the salary.
3. A weekly Interactive Team Session will take place every Saturday between **11:00 a.m. and 1:00 p.m.** This session is designed to encourage knowledge sharing and strengthen team connections.
4. 100% attendance is mandatory for all team members.
5. Each week, a different employee will take the lead to keep the session engaging and collaborative.

### 4.1 Flexible Work Timings
At Early Seed Ventures, we offer flexible work timings to support work-life balance and individual productivity. Employees may begin their workday anytime between **9:30 AM and 11:00 AM**. Based on the chosen start time, employees are expected to complete 8 working hours per day, excluding lunch and tea breaks.

- For example: Start at 9:00 AM → End at 6:00 PM
- Employees who complete a minimum of **4.5 continuous working hours** in a single workday will have their attendance recorded as a half day (without lunch or tea break).

### 4.2 Breaks
The core work duration includes a total of 30 minutes for lunch and 10–15 minutes for a tea break.

- The core work duration includes a total of **30 minutes for lunch** (between 1:00 PM and 2:00 PM) and **15 minutes for a tea break**.
- Employees who follow the flexible schedule should adjust their lunch and tea breaks proportionally within their 8-hour window, ensuring that total break time does not exceed **45 minutes**.

## 5. Responsibilities of Employee

### 4.3 Timelines
On all working days, employees working from the office are expected to begin their workday by the scheduled time they have opted for, after informing HR/Management. Any changes to this chosen time must also be communicated in advance. Grace time is 20 minutes daily.

#### Recording of Time
Employees are required to record their in-time and out-time using the Salary Box Application. When working from the office, the punch-in must be performed from within the office premises. Punch-ins from outside the office premises will be considered invalid.

All remote employees must record their attendance using the Salary Box application, which includes a mandatory live photograph taken at their active workstation at the time of punch-in.

### 4.4 Consequences of Failure
Employees are expected to report to work between **9:30 AM and 11:00 AM** and are required to complete **9 working hours** for the day. Any employee reporting **after 11:00 AM will be considered to have availed a half-day**, and the corresponding **half-day salary will be deducted**.

For remote employees, the punch-in time must accurately reflect the actual commencement of work for the day. Any discrepancy or failure to comply with this requirement may result in the employee being marked absent for the day, subject to review and approval by HR/Management.

### 4.5 Disciplinary Action for Unsatisfactory Attendance
Repeated instances of unsatisfactory attendance may result in disciplinary action, including but not limited to Loss of Pay (LOP) for the affected period and/or termination of employment.

#### 4.5.1 Communication of Absence
- Employees must notify HR/Management as soon as possible via Salary Box or email if they expect to be late or absent from work for any reason. The notification should also include the expected time/date of return.

#### 4.5.2 Termination due to Absence
- If an employee fails to report to work for **three consecutive workdays without notifying management**, it will be considered a voluntary resignation from employment.
- Due to unauthorized absence or absconding, **Early Seed Ventures** will make reasonable efforts to contact the employee via their registered personal contact number before initiating termination. If the employee remains unresponsive, a formal written notice will be issued to their last known residential address and/or personal email ID on record before initiating the termination.

### Work From Home (WFH) Guidelines
- Employees may avail **up to 2 WFH days per month** for valid reasons, subject to prior approval from Management. This provision is applicable to all employees **except those whose appointment letters specifically provide for a separate WFH entitlement**. The 2 WFH days are **non-transferable and cannot be carried forward** to the following month. Any WFH availed **beyond the permitted 2 days in a month will result in a half-day salary deduction for each additional WFH day**.
- In cases where an employee requires additional WFH beyond the permitted 2 days due to illness, employees are encouraged to avail **Sick Leave** or, where the Sick Leave entitlement has been exhausted, **Earned Leave**. **Medical certificates or other medical documents submitted for the purpose of availing WFH beyond the permitted 2 days will not ordinarily be considered for additional WFH entitlement.** Any exception to this provision will be subject to the **sole discretion and approval of Management**.

> **Please note:** Availing more than 2 WFH days in a month may have an adverse impact on performance-related Key Performance Indicators (KPIs), subject to Management's review.

### Attendance, Salary & Performance Impact
Regular attendance, punctuality, compliance with working hours, WFH guidelines, and proper attendance recording are essential requirements of employment.

Any **late arrival, missing punch-in/punch-out, unauthorised WFH, or half-day absence**, as applicable under the Company's policies, may have a **direct impact on the employee's salary**.

Employees will be permitted **up to 2 instances of missed punch-out in a month** without salary deduction. From the **3rd instance onwards, a salary deduction will apply** for each additional missed punch-out.

In addition to salary implications, attendance, punctuality, adherence to WFH guidelines, and overall discipline may also be taken into consideration while assessing the employee's **performance and KPIs**.

All such instances will be reviewed and dealt with in accordance with the applicable Company policies and Management's discretion.

## 6. Saturday Reporting & Timesheet Submission
- All employees are required to submit a **Weekly Work Report every Saturday** through a designated Google Form. This report should include a summary of the week's activities and the plan for the upcoming week.
- Submission of this report is mandatory and will be reviewed by the respective reporting managers for performance tracking and planning purposes.
- Employees must ensure the accurate and timely submission of weekly timesheets, as per the prescribed format and schedule communicated by the HR/Admin team.
- Failure to submit a completed timesheet within the stipulated time frame will result in half a day of leave being deducted from the employee's leave balance for each additional instance. If the leave balance is exhausted, it will then result in a Loss of Pay (LOP).
- Employees must notify their reporting manager or HR at the earliest possible time and provide relevant documentation if required. Approval of such exceptions lies solely with the management.

## 7. Intemperate Weather or Emergency Circumstances
**Early Seed Ventures** acknowledges that adverse weather conditions and emergencies may impact employees' ability to commute. However, we will not officially close solely due to weather conditions. Employees are encouraged to prioritize their safety and well-being when deciding whether to travel.

#### Office closure will only occur if:
- The State or Central Government orders the closure of all highways/roads due to emergencies such as riots, bomb threats, natural disasters, etc.
- A government directive makes it impossible for employees to access the Early Seed Ventures office where they are employed.
- Employees should use their best judgment when assessing travel safety during adverse weather conditions, with safety as the top priority.

#### Other Emergencies
- In cases of emergencies such as fire, power failure, or other critical incidents, the Management will make every effort to inform employees promptly.
- Employees are expected to follow any instructions issued by Management regarding office closures, remote work arrangements, or evacuation procedures during such events.

## 8. Disclaimer
All employees will need to keep in mind that the policy has been designed keeping in mind the current rules & regulations applicable and are subject to change depending on the situation & circumstances. Any changes that are proposed will be communicated in writing as and when required.

> For Earlyseed Ventures — Authorised Signatory: **Monica Gupta**, Co-founder.$policy$
WHERE NOT EXISTS (
  SELECT 1 FROM public.hr_policies
  WHERE org_id = '00000000-0000-0000-0000-000000000001'::uuid
    AND title = 'Attendance and Working Hours Policy'
);

-- ─── 2. Leave ───────────────────────────────────────────────────────────────
INSERT INTO public.hr_policies (org_id, title, category, position, body)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Leave Policy',
  'Leave',
  1,
  $policy$## 1. Introduction
**Early Seed Ventures** is committed to fostering a supportive work environment that prioritizes employee well-being while ensuring business continuity. As part of this commitment, the company provides a structured leave policy that outlines various leave entitlements to promote work-life balance.

## 2. Objectives
The primary objective of the Leave Policy is designed to:

- Provide employees with a structured leave system that promotes work-life balance and well-being.
- Define the various types of leave available and establish eligibility criteria for availing them.
- Ensure a fair and standardized leave approval process to maintain operational efficiency.
- Outline the consequences of unauthorized leave and absenteeism to uphold workplace discipline.

## 3. Scope & Applicability
- This policy applies to all employees, including permanent, contractual, and probationary staff. Leave entitlements may vary based on employment status and tenure.
- The year followed will be **January to December** every year (Calendar Year).
- Employees who are appointed during the course of the year shall be entitled to the leaves on a **pro-rata basis**.
- Employees whose date of joining service falls between the **1st and the 15th** of a month are entitled to get the leave credit for that month.
- Employees whose date of joining service falls between the **16th and the end of the month** are not entitled to the leave credit for that month.
- If an employee is relieved on any day between the 1st and 15th of a month, then they are not entitled to leaves due for that month.

## 4. Benefits
- **Positive Work Environment:** Encouraging time off fosters a positive and supportive work culture.
- **Improved Productivity:** Well-rested employees are generally more focused, productive, and motivated.
- **Compliance and Fairness:** A transparent leave policy ensures the company meets legal requirements and treats all employees fairly.
- **Increased Employee Retention:** A fair leave policy can boost employee satisfaction and loyalty, reducing turnover rates.
- **Enhanced Employee Well-being:** Regular leave ensures employees can rest and recharge, promoting better mental and physical health.

## 5. Policy

### 5.1 Norms for Availing Leaves
- Employees must obtain prior approval for all leave requests through Salary Box. In case Salary Box is not working, they should inform HR by mail.
- In case of unforeseen circumstances requiring sick leave, the employee must notify their Reporting Manager via text/WhatsApp.
- Advance Leave Application:
  - All leave requests, regardless of type, should be applied for and approved at least **3 working days in advance**.
  - For leave exceeding 2 or more working days, employees must apply at least **12 business days in advance**.
- The Management/HR is the final sanctioning authority for all leave approvals.

### 5.2 Leave Application Process
1. **Employee** — submit the leave request via the Salary Box App/email, and personally notify HR/Management that the request has been submitted.
2. **Reporting Manager** — approve or reject the leave request within 2 days.
3. **HR / Admin** — maintain leave records in the Leave Register or any other designated tracking tool.

## 6. Types of Leaves

| Type of leave | No. of leaves |
| --- | --- |
| Earned Leave | 15 |
| Sick Leave | 4 |
| My Day Leave | 1 |
| Special Holiday | 5 |
| Festival/Public Holiday | 10 |

### 6.1 Earned Leave / Planned Leave
Earned Leaves (EL) may be taken for personal reasons, vacations, or any other purpose requiring extended time off.

#### Eligibility
- All employees are entitled to **15 Earned Leaves (ELs) per year**.
- These leaves will be calculated on a pro-rata basis.

#### Advance Planning
- Any planned leave must be requested at least **3 business days in advance**.

#### Carry Forward & Lapse
- Unused ELs can be carried forward to the next year, up to a maximum of **90 days**.
- Any ELs beyond this limit will lapse.
- Half-day leaves cannot be availed under this category.
- Earned Leaves are **not eligible for encashment**.

### 6.2 Sick Leave
Sick Leave is intended for short-term, unforeseen circumstances such as personal illness or medical emergencies.

#### Eligibility
- Employees are entitled to **4 Sick Leaves per year**.
- For the first year of employment, Sick Leave is prorated based on the period worked.

#### Tracking
- Sick Leave can be availed in half-day increments or multiples thereof.

#### Notice & Regularization
- Employees must inform HR/Reporting Manager when availing Sick Leave.

#### Duration & Approval
- Sick Leave exceeding **2 consecutive days** requires approval from management.
- Employees must provide a doctor's certificate for any sick leave beyond 2 days.
- Sick Leave is meant for short durations, typically not exceeding 2–3 days at a time.
- For extended absences, employees may be required to submit additional medical documentation and consider other applicable leave types.

#### Accumulation & Carryover
- Sick Leave cannot be accumulated or carried forward to the next calendar year.

#### Encashment
- Sick Leave is **not eligible for encashment**.

### 6.3 Maternity Leave
Maternity Leave and benefits shall be granted as per the **Maternity Benefit Act, 1961** for women employees not covered under the Employee State Insurance (ESIC) Act, 1948. For women employees covered under the ESIC Act, Maternity Leave and benefits shall be granted as per ESIC provisions.

#### Eligibility
- Women employees are entitled to Maternity Leave if they have completed at least **80 days of service** with the Company in the 12 months preceding the expected delivery date.
- Upon application for Maternity Leave, employees are entitled to **three months of paid leave**, effective from the date of application.
- The third month's salary will be disbursed upon return to work, along with the fourth month's salary.

#### Maternity Leave Entitlement — a) Childbirth Leave
- **First two children:** up to 13 weeks (maximum 4 weeks pre-delivery and 9 weeks post-delivery).
- **From the third child onwards:** up to 6 weeks (3 weeks pre-delivery and 3 weeks post-delivery).

#### Maternity Leave Entitlement — b) Other Leave Entitlements
- **Medical Termination of Pregnancy / Miscarriage:** 6 weeks from the date of termination/miscarriage (as defined under the Maternity Benefit Act, 1961).
- **Tubectomy (Sterilization Procedure):** 2 weeks following the procedure.
- **Adoption Leave:** 6 weeks from the date the child is handed over to the adoptive or commissioning mother.

#### Definitions
- A **"Commissioning Mother"** refers to a biological mother who has used her egg to create an embryo implanted in another woman.
- An **"Adoptive Mother"** refers to a woman who legally adopts a child below the age of three months.

For ESIC-covered employees, leave entitlement beyond 13 weeks (if applicable) will be without pay, and employees must approach ESIC for compensation.

#### Documentation Requirements
- **For Maternity Leave:** a medical certificate and hospital discharge slip must be submitted within one month from the date of delivery.
- **For Adoption Leave:** a certificate from the adoption agency must be provided. Adoption Leave can be availed once in two years, for a maximum of two children.

#### Additional Leave Provisions
- Extended Leave Due to Medical Complications:
  - Employees may extend Maternity Leave by one additional month in case of illness due to pregnancy, delivery, premature birth, stillbirth, or miscarriage.
  - This extension requires approval from the Reporting Manager and management, along with the submission of medical proof.
- Using Earned Leave (EL) or Leave Without Pay (LWP) in Continuation:
  - Employees may extend their leave after fully utilizing their Maternity Leave, subject to managerial approval.

#### General Conditions
- Employees must apply for Maternity Leave at least **four weeks in advance**.
- Maternity Leave cannot be availed in parts, nor can it be carried forward or encashed.
- During Maternity Leave, monthly Earned Leaves will continue to accrue.

### 6.4 My Day Leave
- Employees are entitled to **1 My Day Leave per year**.
- This leave can be taken on the employee's birthday, wedding anniversary, spouse's or child's birthday, or any special occasion.
- The employee must submit a leave application at least **one week in advance**, along with details of the occasion.

### 6.5 Special Holiday Week
At Early Seed Ventures, we recognize the importance of promoting a balanced and fulfilling work environment while encouraging employees to take time off to recharge before the start of a new year. In alignment with this belief, the company grants a **Special Holiday Week** — 5 consecutive days of paid leave, scheduled between the last week of December and the first week of January each year.

- The Special Holiday Week will be from **15th December to 5th January**.
- This leave cannot be carried forward to the next calendar year or encashed. If not availed within the announced period, the entitlement will lapse.

## 7. Festivals / Public Holidays
In addition to the leaves mentioned above, employees will be entitled to **12 holidays in each calendar year** (January to December) for national holidays and festivals. The list of holidays and festivals is published and circulated at the start of the calendar year.

The management will send an email to all employees for any other mandatory leaves/holidays as and when declared by the State or Central Government.

#### Holiday list — 2026

| # | Date | Day | Occasion |
| --- | --- | --- | --- |
| 1 | 01-01-2026 | Thursday | New Year |
| 2 | 26-01-2026 | Monday | Republic Day |
| 3 | 04-03-2026 | Wednesday | Holi |
| 4 | 01-05-2026 | Friday | Maharashtra Day |
| 5 | 15-08-2026 | Saturday | Independence Day |
| 6 | 28-08-2026 | Friday | Raksha Bandhan |
| 7 | 04-09-2026 | Friday | Janmashtami |
| 8 | 14-09-2026 | Monday | Ganesh Chaturthi |
| 9 | 25-09-2026 | Friday | Ganpati Visarjan |
| 10 | 02-10-2026 | Friday | Gandhi Jayanti |
| 11 | 20-10-2026 | Tuesday | Dussera |
| 12 | 09-11-2026 | Monday | Diwali – Govardhan Puja |
| 13 | 10-11-2026 | Tuesday | Hindu New Year |
| 14 | 11-11-2026 | Wednesday | Bhai Dooj |
| 15 | 25-12-2026 | Friday | Christmas |

## 8. Guidelines
- All leave requests must be submitted via the Salary Box App/email for review and approval by HR/Management.
- HR/Management will review all leave requests and grant approvals accordingly.
- In exceptional circumstances, based on Company priorities, Management reserves the right to override any prior leave approval.
- Leaves can be availed only after successful completion of the probation period. **During probation, no leaves are allowed.**
- **Long-duration leave (2 or more working days):** employees must apply at least **12 business days in advance**.
- **Short-duration leave (less than 2 working days):** employees must apply at least **3 working days in advance**.
- This allows the Organization to make necessary arrangements for business continuity.
- Any leave taken beyond the employee's entitlement will result in salary deduction.

## 9. Annexure 1

| Rule | Detail |
| --- | --- |
| At one instance | Earned Leave up to 7, needs to be approved by the Reporting Manager. |
| At one instance | Sick Leave, 2 workdays at max. More than 2 days requires submission of a prescription from a certified medical practitioner. |
| Continuation of SL + EL | Not allowed |
| ML + EL | Allowed |
| AL + EL | Allowed |
| AL + SL | Not allowed |

EL — Earned Leave, SL — Sick Leave, ML — Maternity Leave, AL — Adoption Leave.

> **Note:** All employees will need to keep in mind that the policy has been designed keeping in mind the current rules & regulations applicable and are subject to change depending on the situation & circumstances. Any changes that are proposed will be communicated in writing as and when required.$policy$
WHERE NOT EXISTS (
  SELECT 1 FROM public.hr_policies
  WHERE org_id = '00000000-0000-0000-0000-000000000001'::uuid
    AND title = 'Leave Policy'
);
