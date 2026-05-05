--
-- PostgreSQL database dump
--

\restrict 70oYff2Nu5AQigISL1IZS34jdRpP0TmRbIeyCk6DHR7hMWgYH9mrZpt354j0q8S

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: employeestatus; Type: TYPE; Schema: public; Owner: kpi_user
--

CREATE TYPE public.employeestatus AS ENUM (
    'active',
    'dismissed',
    'maternity',
    'excluded'
);


ALTER TYPE public.employeestatus OWNER TO kpi_user;

--
-- Name: exceptiontype; Type: TYPE; Schema: public; Owner: kpi_user
--

CREATE TYPE public.exceptiontype AS ENUM (
    'dismissed',
    'transferred',
    'excluded',
    'maternity'
);


ALTER TYPE public.exceptiontype OWNER TO kpi_user;

--
-- Name: notificationstatus; Type: TYPE; Schema: public; Owner: kpi_user
--

CREATE TYPE public.notificationstatus AS ENUM (
    'pending',
    'sent',
    'failed',
    'skipped'
);


ALTER TYPE public.notificationstatus OWNER TO kpi_user;

--
-- Name: notificationtype; Type: TYPE; Schema: public; Owner: kpi_user
--

CREATE TYPE public.notificationtype AS ENUM (
    'employee_reminder_3d',
    'employee_reminder_1d',
    'manager_reminder_3d',
    'manager_reminder_1d',
    'admin_no_telegram'
);


ALTER TYPE public.notificationtype OWNER TO kpi_user;

--
-- Name: periodstatus; Type: TYPE; Schema: public; Owner: kpi_user
--

CREATE TYPE public.periodstatus AS ENUM (
    'draft',
    'active',
    'review',
    'closed'
);


ALTER TYPE public.periodstatus OWNER TO kpi_user;

--
-- Name: periodtype; Type: TYPE; Schema: public; Owner: kpi_user
--

CREATE TYPE public.periodtype AS ENUM (
    'monthly',
    'quarterly',
    'yearly'
);


ALTER TYPE public.periodtype OWNER TO kpi_user;

--
-- Name: submissionstatus; Type: TYPE; Schema: public; Owner: kpi_user
--

CREATE TYPE public.submissionstatus AS ENUM (
    'draft',
    'submitted',
    'approved',
    'rejected'
);


ALTER TYPE public.submissionstatus OWNER TO kpi_user;

--
-- Name: syncstatus; Type: TYPE; Schema: public; Owner: kpi_user
--

CREATE TYPE public.syncstatus AS ENUM (
    'success',
    'partial',
    'failed'
);


ALTER TYPE public.syncstatus OWNER TO kpi_user;

--
-- Name: userrole; Type: TYPE; Schema: public; Owner: kpi_user
--

CREATE TYPE public.userrole AS ENUM (
    'employee',
    'manager',
    'admin',
    'finance'
);


ALTER TYPE public.userrole OWNER TO kpi_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: kpi_user
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO kpi_user;

--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: kpi_user
--

CREATE TABLE public.audit_log (
    id uuid NOT NULL,
    user_id character varying,
    user_login character varying,
    action character varying NOT NULL,
    details json,
    ip_address character varying,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.audit_log OWNER TO kpi_user;

--
-- Name: deputy_assignments; Type: TABLE; Schema: public; Owner: kpi_user
--

CREATE TABLE public.deputy_assignments (
    id uuid NOT NULL,
    manager_redmine_id character varying NOT NULL,
    manager_login character varying NOT NULL,
    manager_position_id character varying,
    deputy_redmine_id character varying NOT NULL,
    deputy_login character varying NOT NULL,
    date_from date NOT NULL,
    date_to date,
    is_active boolean,
    comment character varying,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.deputy_assignments OWNER TO kpi_user;

--
-- Name: employees; Type: TABLE; Schema: public; Owner: kpi_user
--

CREATE TABLE public.employees (
    id uuid NOT NULL,
    redmine_id character varying NOT NULL,
    login character varying NOT NULL,
    firstname character varying NOT NULL,
    lastname character varying NOT NULL,
    email character varying,
    telegram_id character varying,
    position_id character varying,
    department_code character varying,
    department_name character varying,
    status public.employeestatus NOT NULL,
    is_active boolean,
    last_synced_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);


ALTER TABLE public.employees OWNER TO kpi_user;

--
-- Name: kpi_change_requests; Type: TABLE; Schema: public; Owner: kpi_user
--

CREATE TABLE public.kpi_change_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type character varying NOT NULL,
    entity_id uuid,
    payload jsonb NOT NULL,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    requested_by character varying NOT NULL,
    reviewed_by character varying,
    review_comment text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.kpi_change_requests OWNER TO kpi_user;

--
-- Name: kpi_criteria; Type: TABLE; Schema: public; Owner: kpi_user
--

CREATE TABLE public.kpi_criteria (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    indicator_id uuid NOT NULL,
    criterion text NOT NULL,
    numerator_label text,
    denominator_label text,
    thresholds jsonb,
    sub_indicators jsonb,
    quarterly_thresholds jsonb,
    cumulative boolean DEFAULT false NOT NULL,
    plan_value character varying,
    common_text_positive text,
    common_text_negative text,
    created_at timestamp with time zone DEFAULT now(),
    sub_type character varying,
    "order" integer DEFAULT 0 NOT NULL,
    value_label character varying,
    is_quarterly boolean DEFAULT false NOT NULL,
    formula_desc text
);


ALTER TABLE public.kpi_criteria OWNER TO kpi_user;

--
-- Name: kpi_indicators; Type: TABLE; Schema: public; Owner: kpi_user
--

CREATE TABLE public.kpi_indicators (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying,
    name text NOT NULL,
    formula_type character varying NOT NULL,
    is_common boolean DEFAULT false NOT NULL,
    is_editable_per_role boolean DEFAULT true NOT NULL,
    status character varying DEFAULT 'draft'::character varying NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    valid_from date,
    valid_to date,
    created_by character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    indicator_group character varying,
    unit_name character varying,
    default_weight integer
);


ALTER TABLE public.kpi_indicators OWNER TO kpi_user;

--
-- Name: kpi_role_card_indicators; Type: TABLE; Schema: public; Owner: kpi_user
--

CREATE TABLE public.kpi_role_card_indicators (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    card_id uuid NOT NULL,
    indicator_id uuid NOT NULL,
    criterion_id uuid,
    weight integer NOT NULL,
    order_num integer DEFAULT 0 NOT NULL,
    override_criterion text,
    override_thresholds jsonb,
    override_weight integer
);


ALTER TABLE public.kpi_role_card_indicators OWNER TO kpi_user;

--
-- Name: kpi_role_cards; Type: TABLE; Schema: public; Owner: kpi_user
--

CREATE TABLE public.kpi_role_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pos_id integer NOT NULL,
    role_id character varying NOT NULL,
    role_name text,
    version integer DEFAULT 1 NOT NULL,
    status character varying DEFAULT 'draft'::character varying NOT NULL,
    valid_from date,
    valid_to date,
    created_by character varying,
    approved_by character varying,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    unit character varying
);


ALTER TABLE public.kpi_role_cards OWNER TO kpi_user;

--
-- Name: kpi_submissions; Type: TABLE; Schema: public; Owner: kpi_user
--

CREATE TABLE public.kpi_submissions (
    id uuid NOT NULL,
    employee_redmine_id character varying NOT NULL,
    employee_login character varying NOT NULL,
    period_id uuid NOT NULL,
    period_name character varying NOT NULL,
    position_id character varying,
    redmine_issue_id integer,
    status public.submissionstatus NOT NULL,
    bin_discipline_summary text,
    bin_schedule_summary text,
    bin_safety_summary text,
    kpi_values json,
    ai_raw_summary text,
    ai_generated_at timestamp with time zone,
    reviewer_redmine_id character varying,
    reviewer_login character varying,
    reviewer_comment text,
    reviewed_at timestamp with time zone,
    submitted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    summary_text text,
    summary_loaded_at timestamp with time zone
);


ALTER TABLE public.kpi_submissions OWNER TO kpi_user;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: kpi_user
--

CREATE TABLE public.notifications (
    id uuid NOT NULL,
    recipient_redmine_id character varying NOT NULL,
    recipient_login character varying NOT NULL,
    recipient_telegram_id character varying,
    notification_type public.notificationtype NOT NULL,
    text text NOT NULL,
    period_id character varying,
    period_name character varying,
    submission_id character varying,
    status public.notificationstatus NOT NULL,
    error_message text,
    dedup_key character varying,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.notifications OWNER TO kpi_user;

--
-- Name: period_exceptions; Type: TABLE; Schema: public; Owner: kpi_user
--

CREATE TABLE public.period_exceptions (
    id uuid NOT NULL,
    period_id uuid NOT NULL,
    employee_redmine_id character varying NOT NULL,
    employee_login character varying NOT NULL,
    exception_type public.exceptiontype NOT NULL,
    event_date date,
    new_position_id character varying,
    new_department_code character varying,
    comment text,
    created_by character varying,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.period_exceptions OWNER TO kpi_user;

--
-- Name: periods; Type: TABLE; Schema: public; Owner: kpi_user
--

CREATE TABLE public.periods (
    id uuid NOT NULL,
    period_type public.periodtype NOT NULL,
    year integer NOT NULL,
    month integer,
    quarter integer,
    name character varying NOT NULL,
    date_start date NOT NULL,
    date_end date NOT NULL,
    submit_deadline date NOT NULL,
    review_deadline date NOT NULL,
    status public.periodstatus NOT NULL,
    redmine_tasks_created boolean,
    redmine_tasks_count integer,
    created_by character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);


ALTER TABLE public.periods OWNER TO kpi_user;

--
-- Name: subordination; Type: TABLE; Schema: public; Owner: kpi_user
--

CREATE TABLE public.subordination (
    position_id character varying NOT NULL,
    evaluator_id character varying,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.subordination OWNER TO kpi_user;

--
-- Name: sync_log; Type: TABLE; Schema: public; Owner: kpi_user
--

CREATE TABLE public.sync_log (
    id uuid NOT NULL,
    sync_type character varying NOT NULL,
    status public.syncstatus NOT NULL,
    total integer,
    created_count integer,
    updated_count integer,
    dismissed_count integer,
    errors_count integer,
    details json,
    started_at timestamp with time zone DEFAULT now(),
    finished_at timestamp with time zone
);


ALTER TABLE public.sync_log OWNER TO kpi_user;

--
-- Name: users; Type: TABLE; Schema: public; Owner: kpi_user
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    redmine_id character varying NOT NULL,
    login character varying NOT NULL,
    firstname character varying NOT NULL,
    lastname character varying NOT NULL,
    email character varying,
    role public.userrole NOT NULL,
    department character varying,
    position_id character varying,
    telegram_id character varying,
    is_active boolean,
    last_synced_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);


ALTER TABLE public.users OWNER TO kpi_user;

--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: kpi_user
--

COPY public.alembic_version (version_num) FROM stdin;
o8p9q0r1s2t3
\.


--
-- Data for Name: audit_log; Type: TABLE DATA; Schema: public; Owner: kpi_user
--

COPY public.audit_log (id, user_id, user_login, action, details, ip_address, created_at) FROM stdin;
0eacd4ab-0a62-470b-bcab-451375e1add1	373	ZaichkoVV	login	\N	192.168.65.1	2026-04-14 17:20:30.252611+00
d3721d61-3a31-467f-aead-a6e1b1c29934	373	ZaichkoVV	login	\N	172.18.0.4	2026-04-14 17:34:02.961755+00
9b9f71f6-4502-4cbc-ac59-14868b4f149d	373	ZaichkoVV	login	\N	192.168.65.1	2026-04-14 18:08:36.310776+00
fbf22587-f041-4e42-a838-d62be256ceaf	373	ZaichkoVV	login	\N	151.101.128.223	2026-04-16 18:26:09.281484+00
f9320b29-5a65-41dc-8ab3-8a9ad7e3ce8c	373	ZaichkoVV	login	\N	172.18.0.4	2026-04-16 18:40:13.800373+00
a586024d-ab40-4bb1-b967-f3209605e976	373	ZaichkoVV	login	\N	160.79.104.10	2026-04-16 19:33:17.772217+00
90c4b047-f176-4738-949f-f355e625ed84	373	ZaichkoVV	login	\N	160.79.104.10	2026-04-16 19:43:22.267977+00
6b9773f6-59c3-4221-a9b0-53a0c759a89b	373	ZaichkoVV	login	\N	160.79.104.10	2026-04-16 19:47:13.787395+00
ca433d91-8967-42e6-b096-c547f61e10bf	373	ZaichkoVV	login	\N	160.79.104.10	2026-04-16 19:50:29.976169+00
0e8db88f-0954-452e-9ab9-ec6f7d5060d9	373	ZaichkoVV	login	\N	160.79.104.10	2026-04-16 19:52:06.606864+00
ae076ed1-c14b-49ee-82b2-724bfd6c2194	373	ZaichkoVV	login	\N	160.79.104.10	2026-04-16 19:53:54.484756+00
026a01ae-1faf-4a03-a6b1-43d76d024b51	373	ZaichkoVV	login	\N	172.18.0.4	2026-04-16 20:02:24.183432+00
c6b9db92-28c8-4ab7-8f9f-7fedb8dfded0	373	ZaichkoVV	login	\N	172.18.0.4	2026-04-16 21:29:15.355195+00
9e851cd2-e509-427a-8542-f49c5a871d7b	373	ZaichkoVV	login	\N	172.18.0.4	2026-04-16 21:35:02.187387+00
1e7a6bb9-2d35-4925-a613-90c0c03ec17b	373	ZaichkoVV	login	\N	172.18.0.4	2026-04-16 21:38:46.282868+00
7b1f48c9-6cef-4f08-8bd0-b043d895433e	373	ZaichkoVV	login	\N	172.18.0.4	2026-04-16 21:51:15.716903+00
b53f766e-fcc5-4dae-b3d6-8d3585c8cfc0	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-16 22:02:29.159356+00
8ac30291-954b-4945-aa3e-647826910f77	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-16 22:21:42.467263+00
dc7c6486-bcc0-4a24-a8bb-f666fb0ac20d	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-17 12:03:45.938875+00
9753c42d-76f2-4e4e-aeb5-d00df9eb377c	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-17 12:05:45.770548+00
58b92ab4-0957-49b1-8bd2-7a3f15b5af33	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-17 12:31:53.707808+00
d531b123-2aa4-43bb-8ab9-3906e07f1851	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-17 12:33:50.357307+00
10f46eb4-d246-4cfd-836c-a85c4ba9673e	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-17 12:35:39.04816+00
1d5cf9a0-66e7-4d56-b4d2-c0177cec7d5e	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-17 12:36:26.646426+00
f6215498-cdc4-47f1-a2a1-5db11e8b9b06	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-17 12:37:35.089896+00
c041bc9b-75bc-49bc-a62c-a1c89b748f72	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-17 12:37:49.056516+00
ad9d495a-ce68-443d-a4dc-b46bf229b8c2	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-17 21:02:39.06216+00
7c791083-2d30-49a6-8516-7c1157572838	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-17 21:03:41.19668+00
cebf9dbb-12d2-4df4-bf4a-73452b400fc7	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-17 21:04:46.387589+00
6666ec3f-f3ea-432a-9ef6-8dc8db01b7fe	373	ZaichkoVV	login	\N	160.79.104.10	2026-04-17 21:15:14.847973+00
e128c95b-5863-4703-91d0-4a0515b96e0b	373	ZaichkoVV	login	\N	160.79.104.10	2026-04-17 21:15:31.242252+00
0086a1e9-3e98-4661-848b-7aa87a4e4260	373	ZaichkoVV	login	\N	160.79.104.10	2026-04-17 21:15:50.190961+00
a2ebec45-4771-4b5a-bd62-e681ee36f32c	373	ZaichkoVV	login	\N	160.79.104.10	2026-04-17 21:16:17.502093+00
a6a33e66-9400-40d7-86d8-66ab8f9b109c	373	ZaichkoVV	login	\N	160.79.104.10	2026-04-17 21:17:30.041347+00
f8c12aef-3cab-476e-a052-6f95919bd642	373	ZaichkoVV	login	\N	160.79.104.10	2026-04-17 21:18:04.304116+00
9e296574-2a51-431c-b734-6b2be5b3d658	373	ZaichkoVV	login	\N	160.79.104.10	2026-04-17 21:18:36.581857+00
9d3f357a-5f69-472b-8ca6-99c3071b7644	373	ZaichkoVV	login	\N	160.79.104.10	2026-04-17 21:19:26.014896+00
50276a32-1e49-4dc2-8b5a-5b39956ac28d	373	ZaichkoVV	login	\N	160.79.104.10	2026-04-17 21:20:01.180232+00
f57096ee-e68c-4675-97cd-d3fd0479c18d	373	ZaichkoVV	login	\N	160.79.104.10	2026-04-17 21:20:26.890153+00
430bb180-83a3-4d59-92a6-50831d58e107	373	ZaichkoVV	login	\N	160.79.104.10	2026-04-17 21:20:40.136126+00
9fa9d5f2-2b93-46fd-ab22-fc02e82c2759	373	ZaichkoVV	login	\N	160.79.104.10	2026-04-17 21:21:08.737014+00
4cf64232-4171-4cbe-a347-935399c21ffd	373	ZaichkoVV	login	\N	160.79.104.10	2026-04-17 21:21:19.16688+00
a066718b-8045-40cf-8c7b-b87dacbde226	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-17 21:25:12.001981+00
afde4a80-d02f-4b8a-808f-9f0905498044	373	ZaichkoVV	login	\N	160.79.104.10	2026-04-17 21:28:32.603412+00
65b316cc-d025-4975-903b-ea2a483674ee	373	ZaichkoVV	login	\N	160.79.104.10	2026-04-17 21:28:46.64961+00
440327ea-81fe-4de3-b2e0-6f073f6b763c	373	ZaichkoVV	login	\N	160.79.104.10	2026-04-17 21:29:13.312148+00
660e5bcd-20f6-4dd0-ad2b-5140b444a885	373	ZaichkoVV	login	\N	160.79.104.10	2026-04-17 21:32:20.079298+00
9723e822-ebe5-46cc-bb0d-68a4bbe4807f	373	ZaichkoVV	login	\N	160.79.104.10	2026-04-17 21:35:23.268175+00
df368e34-3b96-487d-b869-6b03c7dfeb78	373	ZaichkoVV	login	\N	160.79.104.10	2026-04-17 21:36:02.166841+00
bc8e1f7c-95eb-4774-b7b7-faaec67f62ba	373	ZaichkoVV	login	\N	160.79.104.10	2026-04-17 21:36:17.79979+00
bc1ea93c-abb8-49af-97c4-edbb90fe7161	373	ZaichkoVV	login	\N	160.79.104.10	2026-04-17 21:36:29.746488+00
79f3d396-f76f-4be6-b4ff-8d4002eca93d	373	ZaichkoVV	binary_manual_scored	{"submission_id": "28248a1f-3acf-41f7-8894-92107617c3f5", "kpi_index": 1, "score": 100, "criterion": "\\u0421\\u043e\\u0431\\u043b\\u044e\\u0434\\u0435\\u043d\\u0438\\u0435 \\u041f\\u0440\\u0430\\u0432\\u0438\\u043b \\u0432\\u043d\\u0443\\u0442\\u0440\\u0435\\u043d\\u043d\\u0435\\u0433\\u043e \\u0442\\u0440\\u0443\\u0434\\u043e\\u0432\\u043e\\u0433\\u043e \\u0440\\u0430\\u0441\\u043f\\u043e\\u0440\\u044f\\u0434\\u043a\\u0430"}	\N	2026-04-17 21:36:29.875642+00
f118fe32-651e-4bd6-815e-97d43a1f61f7	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-17 21:38:55.015061+00
6d514877-d459-4519-bd97-67d4ad833c60	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-18 09:50:04.667796+00
c4ad5ed7-1f83-4058-8273-dab6b48ca972	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-18 12:08:03.787197+00
ab7adcd4-a30d-425b-be5d-5cc00969ebc9	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-18 12:14:51.701111+00
ccb8167c-47b9-4e11-8952-f95c9f9c8d11	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-18 12:14:54.704947+00
ad78c8e9-3f55-43e5-92c4-6fe663b4a1fd	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-18 12:33:29.658619+00
ac36560a-b500-475a-be99-05241ee76aaf	373	ZaichkoVV	binary_manual_scored	{"submission_id": "28248a1f-3acf-41f7-8894-92107617c3f5", "kpi_index": 1, "score": 100, "criterion": "\\u0421\\u043e\\u0431\\u043b\\u044e\\u0434\\u0435\\u043d\\u0438\\u0435 \\u041f\\u0440\\u0430\\u0432\\u0438\\u043b \\u0432\\u043d\\u0443\\u0442\\u0440\\u0435\\u043d\\u043d\\u0435\\u0433\\u043e \\u0442\\u0440\\u0443\\u0434\\u043e\\u0432\\u043e\\u0433\\u043e \\u0440\\u0430\\u0441\\u043f\\u043e\\u0440\\u044f\\u0434\\u043a\\u0430"}	\N	2026-04-18 12:34:11.65722+00
d1a4d44d-d51d-43dc-93b1-f92480963436	373	ZaichkoVV	binary_manual_scored	{"submission_id": "28248a1f-3acf-41f7-8894-92107617c3f5", "kpi_index": 1, "score": 100, "criterion": "\\u0421\\u043e\\u0431\\u043b\\u044e\\u0434\\u0435\\u043d\\u0438\\u0435 \\u041f\\u0440\\u0430\\u0432\\u0438\\u043b \\u0432\\u043d\\u0443\\u0442\\u0440\\u0435\\u043d\\u043d\\u0435\\u0433\\u043e \\u0442\\u0440\\u0443\\u0434\\u043e\\u0432\\u043e\\u0433\\u043e \\u0440\\u0430\\u0441\\u043f\\u043e\\u0440\\u044f\\u0434\\u043a\\u0430"}	\N	2026-04-18 12:34:20.219248+00
0a86cdd3-867a-4ac7-8b20-3067223bde12	373	ZaichkoVV	binary_manual_scored	{"submission_id": "28248a1f-3acf-41f7-8894-92107617c3f5", "kpi_index": 1, "score": 0, "criterion": "\\u0421\\u043e\\u0431\\u043b\\u044e\\u0434\\u0435\\u043d\\u0438\\u0435 \\u041f\\u0440\\u0430\\u0432\\u0438\\u043b \\u0432\\u043d\\u0443\\u0442\\u0440\\u0435\\u043d\\u043d\\u0435\\u0433\\u043e \\u0442\\u0440\\u0443\\u0434\\u043e\\u0432\\u043e\\u0433\\u043e \\u0440\\u0430\\u0441\\u043f\\u043e\\u0440\\u044f\\u0434\\u043a\\u0430"}	\N	2026-04-18 12:34:21.769083+00
098155f2-8308-45bd-9996-9099895a2a46	373	ZaichkoVV	binary_manual_scored	{"submission_id": "28248a1f-3acf-41f7-8894-92107617c3f5", "kpi_index": 1, "score": 100, "criterion": "\\u0421\\u043e\\u0431\\u043b\\u044e\\u0434\\u0435\\u043d\\u0438\\u0435 \\u041f\\u0440\\u0430\\u0432\\u0438\\u043b \\u0432\\u043d\\u0443\\u0442\\u0440\\u0435\\u043d\\u043d\\u0435\\u0433\\u043e \\u0442\\u0440\\u0443\\u0434\\u043e\\u0432\\u043e\\u0433\\u043e \\u0440\\u0430\\u0441\\u043f\\u043e\\u0440\\u044f\\u0434\\u043a\\u0430"}	\N	2026-04-18 12:34:22.716758+00
254e6f9f-c234-4237-8db1-ce00f3155a11	373	ZaichkoVV	binary_manual_scored	{"submission_id": "28248a1f-3acf-41f7-8894-92107617c3f5", "kpi_index": 2, "score": 100, "criterion": "\\u0421\\u043e\\u0431\\u043b\\u044e\\u0434\\u0435\\u043d\\u0438\\u0435 \\u043f\\u0440\\u0430\\u0432\\u0438\\u043b \\u043e\\u0445\\u0440\\u0430\\u043d\\u044b \\u0442\\u0440\\u0443\\u0434\\u0430"}	\N	2026-04-18 12:34:25.952187+00
6433d6d5-84b4-4793-9ff2-828a9444e0c8	373	ZaichkoVV	binary_manual_scored	{"submission_id": "28248a1f-3acf-41f7-8894-92107617c3f5", "kpi_index": 2, "score": 0, "criterion": "\\u0421\\u043e\\u0431\\u043b\\u044e\\u0434\\u0435\\u043d\\u0438\\u0435 \\u043f\\u0440\\u0430\\u0432\\u0438\\u043b \\u043e\\u0445\\u0440\\u0430\\u043d\\u044b \\u0442\\u0440\\u0443\\u0434\\u0430"}	\N	2026-04-18 12:34:27.919326+00
6e477602-29b1-4d19-90ec-de206d4e98ec	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-18 12:49:32.340278+00
d2b242ac-ad5c-487a-9893-9162d3935655	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-18 12:57:17.573254+00
5f4abf26-0105-43ce-a5f0-622e4999e284	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-18 14:53:39.715944+00
1a98c7ee-e5bb-4016-ae75-0cc9b036856b	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-18 15:14:30.167224+00
ff87dfa6-bd16-434f-81f1-0c604c2d0136	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-18 18:56:47.475284+00
f0f6a10c-72f7-478c-8740-6cc28074f7cb	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-18 18:56:51.653252+00
566e4f55-3b84-4a56-b701-299a5e9e5610	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-18 18:57:32.572247+00
d5ff3fc8-f87e-400f-9e3d-911b22783bf3	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-18 19:01:40.535668+00
df8a05a6-2334-4dcc-b4dd-084fc22279fd	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-18 19:02:51.474536+00
3c6e824c-2cf5-4065-aabf-ce1eb6e7bdbd	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-18 19:04:07.534422+00
7d24f9e3-dc7a-4bad-85db-776dd5a7fefa	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-18 19:04:18.772149+00
008c1559-60a1-4c4a-95f3-cf8e37c69bf4	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-18 19:07:38.78028+00
a86b5dca-4695-4675-9d3f-ff1f93f6b42a	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-18 19:47:43.241591+00
056b0cda-1a52-4b1d-8e4e-091bb8e3e9fb	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-18 20:07:08.091848+00
a7e944b1-25aa-4191-b79c-b20989ffa2be	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-18 20:44:17.617997+00
74b88a6e-b8ec-4414-b83f-303c39a428f5	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-18 20:54:40.823228+00
2b3cdebe-7769-4d2c-b435-ce2e7163c6cd	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-19 11:19:47.264332+00
7f8c008f-f735-426d-bbdc-48fbe44e1a59	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-19 11:35:13.158343+00
c78caabe-6638-4d12-8e82-e44c5604344e	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-19 11:50:34.400346+00
8423bbae-324e-461e-98e3-0ec8d1b019a9	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-19 14:44:38.116215+00
1968bd42-bb51-4a8b-b87d-2e55e5051454	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-19 20:03:42.217101+00
2ddf1594-63db-41a2-80ec-b020a3fded99	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-19 20:07:36.420328+00
2f7298db-e64f-4979-94e1-62a1ec2d3d83	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-19 20:23:06.276248+00
3c4a9cc6-6d6f-4e23-b4bb-36134e793929	373	ZaichkoVV	login	\N	172.66.0.243	2026-04-20 06:02:55.472615+00
15961ebc-5cbd-429a-a5d7-4406bb8d4dea	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-20 06:08:35.026081+00
bd358368-39cd-44a6-b147-35dcd3a354ca	373	ZaichkoVV	login	\N	172.66.0.243	2026-04-20 06:32:34.486802+00
357472c8-0cb4-4404-b49b-b778307fb05e	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-24 17:13:07.88654+00
17c28480-7d1c-4095-b0b4-81ac0d45034c	373	ZaichkoVV	login	\N	172.66.0.243	2026-04-24 17:14:48.315611+00
bafa3ff8-fb03-44f6-b322-4d6f6569ab4b	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-24 18:42:49.440324+00
4d9f0a13-4ea9-4199-b71b-a852c8810ce1	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-24 19:07:07.760152+00
edd3908d-f2d6-409b-8966-9a97e3a30fdb	373	ZaichkoVV	login	\N	172.66.0.243	2026-04-28 10:04:13.374123+00
54b31fdf-94d9-4143-9186-726e279f10ea	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-28 10:08:08.622927+00
3977c3c5-7799-406d-b4f5-c499dd3b0da6	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-28 13:20:27.953231+00
9b10984f-32ad-4968-89a6-44e05a097144	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-28 13:34:24.137005+00
50f44055-cec6-4dec-9e62-071351a65422	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-29 07:06:45.742636+00
24d82ede-dd62-413d-be79-5d9a4ae1e1fe	373	ZaichkoVV	binary_manual_scored	{"submission_id": "9fb67010-ebfc-4c9c-854c-7fc7ea9ffec5", "kpi_index": 1, "score": 100, "criterion": "\\u0421\\u043e\\u0431\\u043b\\u044e\\u0434\\u0435\\u043d\\u0438\\u0435 \\u0438\\u0441\\u043f\\u043e\\u043b\\u043d\\u0438\\u0442\\u0435\\u043b\\u044c\\u0441\\u043a\\u043e\\u0439 \\u0434\\u0438\\u0441\\u0446\\u0438\\u043f\\u043b\\u0438\\u043d\\u044b \\u043f\\u0440\\u0438 \\u0440\\u0430\\u0431\\u043e\\u0442\\u0435 \\u0432 \\u043c\\u0435\\u0436\\u0432\\u0435\\u0434\\u043e\\u043c\\u0441\\u0442\\u0432\\u0435\\u043d\\u043d\\u043e\\u0439 \\u0441\\u0438\\u0441\\u0442\\u0435\\u043c\\u0435 \\u044d\\u043b\\u0435\\u043a"}	\N	2026-04-29 11:48:12.316607+00
36761fe6-10db-476b-8fac-0a81a20d5486	373	ZaichkoVV	binary_manual_scored	{"submission_id": "9fb67010-ebfc-4c9c-854c-7fc7ea9ffec5", "kpi_index": 2, "score": 100, "criterion": "\\u0421\\u043e\\u0431\\u043b\\u044e\\u0434\\u0435\\u043d\\u0438\\u0435 \\u041f\\u0440\\u0430\\u0432\\u0438\\u043b \\u0432\\u043d\\u0443\\u0442\\u0440\\u0435\\u043d\\u043d\\u0435\\u0433\\u043e \\u0442\\u0440\\u0443\\u0434\\u043e\\u0432\\u043e\\u0433\\u043e \\u0440\\u0430\\u0441\\u043f\\u043e\\u0440\\u044f\\u0434\\u043a\\u0430, \\u041a\\u043e\\u0434\\u0435\\u043a\\u0441\\u0430 \\u044d\\u0442\\u0438\\u043a\\u0438"}	\N	2026-04-29 11:48:13.555736+00
64e1e031-75e6-4a01-9027-68300a5831e4	373	ZaichkoVV	binary_manual_scored	{"submission_id": "9fb67010-ebfc-4c9c-854c-7fc7ea9ffec5", "kpi_index": 3, "score": 100, "criterion": "\\u0421\\u043e\\u0431\\u043b\\u044e\\u0434\\u0435\\u043d\\u0438\\u0435 \\u043f\\u0440\\u0430\\u0432\\u0438\\u043b \\u0438 \\u043d\\u043e\\u0440\\u043c \\u0442\\u0435\\u0445\\u043d\\u0438\\u043a\\u0438 \\u0431\\u0435\\u0437\\u043e\\u043f\\u0430\\u0441\\u043d\\u043e\\u0441\\u0442\\u0438, \\u043e\\u0445\\u0440\\u0430\\u043d\\u044b \\u0442\\u0440\\u0443\\u0434\\u0430 \\u0438 \\u043f\\u0440\\u043e\\u0442\\u0438\\u0432\\u043e\\u043f\\u043e\\u0436\\u0430\\u0440\\u043d\\u043e\\u0433\\u043e \\u0440"}	\N	2026-04-29 11:48:15.024058+00
c49107f1-ead7-46cf-b611-9c0124e59d44	373	ZaichkoVV	binary_manual_scored	{"submission_id": "9fb67010-ebfc-4c9c-854c-7fc7ea9ffec5", "kpi_index": 2, "score": 0, "criterion": "\\u0421\\u043e\\u0431\\u043b\\u044e\\u0434\\u0435\\u043d\\u0438\\u0435 \\u041f\\u0440\\u0430\\u0432\\u0438\\u043b \\u0432\\u043d\\u0443\\u0442\\u0440\\u0435\\u043d\\u043d\\u0435\\u0433\\u043e \\u0442\\u0440\\u0443\\u0434\\u043e\\u0432\\u043e\\u0433\\u043e \\u0440\\u0430\\u0441\\u043f\\u043e\\u0440\\u044f\\u0434\\u043a\\u0430, \\u041a\\u043e\\u0434\\u0435\\u043a\\u0441\\u0430 \\u044d\\u0442\\u0438\\u043a\\u0438"}	\N	2026-04-29 11:49:20.714966+00
11862f94-bddd-45c3-a5f0-b4236da77547	373	ZaichkoVV	binary_auto_override	{"submission_id": "9fb67010-ebfc-4c9c-854c-7fc7ea9ffec5", "kpi_index": 0, "manager_override": true, "ai_score": 0, "criterion": "\\u0414\\u0435\\u0442\\u0430\\u043b\\u044c\\u043d\\u043e\\u0435 \\u043e\\u043f\\u0438\\u0441\\u0430\\u043d\\u0438\\u044f \\u0438 \\u0432\\u0438\\u0437\\u0443\\u0430\\u043b\\u044c\\u043d\\u043e\\u0435 \\u043e\\u0442\\u043e\\u0431\\u0440\\u0430\\u0436\\u0435\\u043d\\u0438\\u044f \\u0432\\u0441\\u0435\\u0445 \\u043f\\u0440\\u043e\\u0446\\u0435\\u0441\\u0441\\u043e\\u0432, \\u0441 \\u0438\\u0441\\u043f\\u043e\\u043b\\u044c\\u0437\\u043e\\u0432\\u0430\\u043d\\u0438\\u0435\\u043c \\u0441\\u043f\\u0435"}	\N	2026-04-29 14:52:27.865584+00
66b8b565-31d7-465e-a7f7-9a5f5fa4d4c2	373	ZaichkoVV	login	\N	172.18.0.5	2026-04-29 18:51:58.152971+00
ab1b5f21-2441-4e46-89fa-9b2febb550c1	373	zaichkovv	login	\N	172.66.0.243	2026-04-30 07:40:47.136944+00
07542ee4-ee1a-4d79-84d0-341711af2f4d	373	zaichkovv	login	\N	172.66.0.243	2026-04-30 12:06:29.372063+00
6a01d8a7-1a56-44e4-9f04-25b3192ca12b	373	zaichkovv	login	\N	172.66.0.243	2026-05-02 06:49:39.973114+00
141a1fc2-6778-409a-84f4-c57ab1257446	373	ZaichkoVV	login	\N	172.18.0.5	2026-05-02 18:34:52.083826+00
dcf6f3ee-5bfb-43b7-beb2-7c8b6d439cd8	373	ZaichkoVV	login	\N	172.18.0.5	2026-05-02 19:34:38.521578+00
1c57baa4-86c5-4d9b-885c-f8f4e3ebb045	373	ZaichkoVV	login	\N	172.18.0.5	2026-05-03 08:17:32.434713+00
7c3e3569-79cb-447b-a264-95ba8dc67fb3	373	ZaichkoVV	login	\N	172.18.0.5	2026-05-03 08:31:57.231013+00
768e975e-589e-4b41-836f-adeafe57e674	373	ZaichkoVV	login	\N	172.18.0.5	2026-05-03 09:06:53.933936+00
b2c9edba-0524-4167-b110-36bf84b77d66	373	ZaichkoVV	login	\N	172.18.0.5	2026-05-04 11:41:11.541003+00
\.


--
-- Data for Name: deputy_assignments; Type: TABLE DATA; Schema: public; Owner: kpi_user
--

COPY public.deputy_assignments (id, manager_redmine_id, manager_login, manager_position_id, deputy_redmine_id, deputy_login, date_from, date_to, is_active, comment, created_at) FROM stdin;
\.


--
-- Data for Name: employees; Type: TABLE DATA; Schema: public; Owner: kpi_user
--

COPY public.employees (id, redmine_id, login, firstname, lastname, email, telegram_id, position_id, department_code, department_name, status, is_active, last_synced_at, created_at, updated_at) FROM stdin;
24be9f5d-da87-4ff6-a85b-425d0d5503b9	451	MatveevaKA	Ксения	Матвеева	MatveevaKA@mosreg.ru	1317859037	14	kpi-org	УП организационного обеспечения	active	t	2026-05-03 06:34:31.126474+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
2486900a-74d6-4c96-9057-72f8d1018465	435	AkhsianovaAK	Алсу	Ахсянова	AkhsianovaAK@mosreg.ru	\N	15	kpi-org	УП организационного обеспечения	dismissed	f	2026-04-19 14:45:04.998182+00	2026-04-14 18:02:33.279077+00	2026-04-24 17:18:25.587719+00
25878cb5-9e32-43b2-b3c2-de06fbf01d0a	129	KorablinaOlN	Ольга	Воронина	KorablinaOlN@mosreg.ru	1648399790	2	kpi-ruk	Руководство	active	t	2026-05-03 06:34:29.532408+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
27c30220-6392-4a7e-8ba6-3f299c720caa	357	KoriakinaEA	Екатерина	Корякина	KoriakinaEA@mosreg.ru	7259486185	36	kpi-pra	Правовое управление	active	t	2026-05-03 06:34:29.645248+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
28d3c1d2-6ca2-4c96-967c-5b3b07c8aa4d	457	AmelinaDR	Дарья	Амелина	AmelinaDR@mosreg.ru	\N	66	kpi-zpr	УП проведения, мониторинга и аналитики ЗИТ	active	t	2026-05-03 06:34:25.365407+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
2b632a05-9dab-451b-9476-eb4170984680	152	BerezkinAS	Алексей	Березкин	BerezkinAS@mosreg.ru	1223532137	34	kpi-pra	Правовое управление	active	t	2026-05-03 06:34:26.085607+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
2ba63999-29f6-4f78-8609-88978106b83f	393	VolodinKO	Кирилл	Володин	VolodinKO@mosreg.ru	607742498	82	kpi-iaa	УП анализа и автоматизации данных	active	t	2026-05-03 06:34:34.129181+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
3062d0d0-ee7d-434d-9d9d-22526b736b41	455	AgaevDE	Даниэль	Агаев	AgaevDE@mosreg.ru	362370407	29	kpi-feo	УП методологии развития ЕАСУЗ	active	t	2026-05-03 06:34:24.889475+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
306c7aad-9d85-42b3-908d-412c8034e1c0	411	BeltiugovRV	Руслан	Бельтюгов	BeltiugovRV@mosreg.ru	1501905373	73	kpi-tsr	УП цифровой трансформации	active	t	2026-05-03 06:34:25.968008+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
32b7a40b-c4ab-4459-83d5-f15387842819	446	DemidiukIaN	Ярослав	Демидюк	DemidiukIaN@mosreg.ru	5200652017	8	kpi-org	УП организационного обеспечения	active	t	2026-05-03 06:34:26.96653+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
3728c057-7c07-4824-9f19-8ebd70701443	377	ZavialovaEI	Елена	Завьялова	ZavialovaEI@mosreg.ru	5151085859	9	kpi-org	УП организационного обеспечения	active	t	2026-05-03 06:34:34.542671+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
378e0094-22ec-4950-a311-f079190c6138	415	ShestakMV	Маргарита	Шестак	ShestakMV@mosreg.ru	543350800	41	kpi-pra	Правовое управление	active	t	2026-05-03 06:34:32.954086+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
37f70b93-2cba-4048-b308-2343a48b039c	383	PetuninaEvAn	Евгения	Петунина	PetuninaEvAn@mosreg.ru	780910188	7	kpi-org	УП организационного обеспечения	active	t	2026-05-03 06:34:32.426863+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
385783fa-d12e-4f4f-960d-8a8aa51a89f8	343	KhasarokovaSS	Светлана	Хасарокова	KhasarokovaSS@mosreg.ru	778422915	68	kpi-zpr	УП проведения, мониторинга и аналитики ЗИТ	active	t	2026-05-03 06:34:28.504182+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
399c7409-fea4-479d-b2c0-80bcf627c93b	144	FedorovaTatAn	Татьяна	Волхонская	FedorovaTatAn@mosreg.ru	899145171	37	kpi-pra	Правовое управление	active	t	2026-05-03 06:34:27.431828+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
43434936-09ea-4e94-a0dc-9eb8da5832c8	432	KukartsevaOV	Ольга	Кукарцева	KukartsevaOV@mosreg.ru	540411257	42	kpi-kza	УП сопровождения корпоративных закупок	active	t	2026-05-03 06:34:30.780739+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
87321ddf-c3e4-4aa9-875f-129d8a3419bd	389	KhorevOlG	Олег	Хорев	KhorevOlG@mosreg.ru	860849364	3	kpi-ruk	Руководство	active	t	2026-05-03 06:34:28.660525+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
44509ff2-ff7b-47e2-af73-bb22d3318036	352	KorotaevaNP	Наталия	Коротаева	KorotaevaNP@mosreg.ru	5176681749	55	kpi-zpd	УП подготовки ЗИТ	active	t	2026-05-03 06:34:29.97286+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
489d54ae-84e8-4cc8-a80d-0d78b81592c6	409	KolmogortsevaVD	Виктория	Колмогорцева	KolmogortsevaVD@mosreg.ru	6870068202	36	kpi-pra	Правовое управление	active	t	2026-05-03 06:34:29.11708+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
80a67f15-7bea-4314-bc0c-2e2c4ad07ee1	410	AdrianovskaiaElI	Елизавета	Адриановская	AdrianovskaiaElI@mosreg.ru	\N	80	kpi-tsr	УП цифровой трансформации	active	t	2026-05-03 06:34:24.794878+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
8ffc83fd-62e8-4a76-8e19-9509521448c1	440	KorolkovaDA	Дарья	Королькова	KorolkovaDA@mosreg.ru	\N	90	kpi-iaa	УП анализа и автоматизации данных	active	t	2026-05-03 06:34:29.86333+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
9366a520-4fe1-4315-96b9-091a2c9881b3	312	KovalskiyPM	Павел	Ковальский	KovalskiyPM@mosreg.ru	156741525	6	kpi-org	УП организационного обеспечения	active	t	2026-05-03 06:34:30.546097+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
956d01b4-121a-424e-807a-7c1d802473b6	215	MeliukhKV	Ксения	Мелюх	MeliukhKV@mosreg.ru	836695624	18	kpi-org	УП организационного обеспечения	active	t	2026-05-03 06:34:31.420307+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
9c6d1fcd-29ee-4260-896e-c2d2e8459c5c	434	ElokhinaTA	Татьяна	Елохина	ElokhinaTA@mosreg.ru	\N	69	kpi-zpr	УП проведения, мониторинга и аналитики ЗИТ	active	t	2026-05-03 06:34:27.1671+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
a1f23790-7f35-48d8-91e8-96c8c0815bd2	112	PetrovAlMi	Александр	Петров	PetrovAlMi@mosreg.ru	1196189006	28	kpi-feo	УП методологии развития ЕАСУЗ	active	t	2026-05-03 06:34:32.295304+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
a2cdd0c4-e1f6-4553-86c3-a8585a1d91fd	199	UlevichES	Елена	Ульевич	UlevichES@mosreg.ru	353026168	54	kpi-zpd	УП подготовки ЗИТ	active	t	2026-05-03 06:34:33.700859+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
a3908442-a625-41c7-bebe-b37b473aa9de	244	PozdniakovaTS	Татьяна	Позднякова	PozdniakovaTS@mosreg.ru	658315362	72	kpi-tsr	УП цифровой трансформации	active	t	2026-05-03 06:34:32.717297+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
acede595-3f4a-4935-aba5-7c104eed569f	365	MaykovaVaS	Валерия	Майкова	MaykovaVaS@mosreg.ru	1032946825	23	kpi-feo	УП методологии развития ЕАСУЗ	active	t	2026-05-03 06:34:31.242685+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
ae794bbe-2817-46b6-a88a-1faafa09e876	431	KhalikovaAI	Аида	Халикова	KhalikovaAI@mosreg.ru	1560935582	60	kpi-zpd	УП подготовки ЗИТ	active	t	2026-05-03 06:34:28.32111+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
b0bf83ca-99ec-43a6-96b1-3d8c7e26d26a	371	ChaykaMaO	Марина	Чайка	ChaykaMaO@mosreg.ru	712499498	17	kpi-org	УП организационного обеспечения	active	t	2026-05-03 06:34:26.424808+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
b19f32fe-1b60-4442-9ea8-1293281cf2e8	400	KulikovaVN	Вера	Куликова	KulikovaVN@mosreg.ru	959442780	57	kpi-zpd	УП подготовки ЗИТ	active	t	2026-05-03 06:34:30.884915+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
b700ee1b-d27c-4ed8-b128-0bea69f83a66	248	OsipovaNaAn	Наталия	Митрошина	OsipovaNaAn@mosreg.ru	1799646242	67	kpi-zpr	УП проведения, мониторинга и аналитики ЗИТ	active	t	2026-05-03 06:34:31.916902+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
b76cfc0f-0b87-4ee2-aa68-53d4f98c102a	443	TalkoND	Никита	Талько	TalkoND@mosreg.ru	\N	65	kpi-zpr	УП проведения, мониторинга и аналитики ЗИТ	active	t	2026-05-03 06:34:33.217858+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
b84fdbe9-aced-4603-ace2-55e4eac275a9	292	DaniushevskaiaSM	Светлана	Данюшевская	DaniushevskaiaSM@mosreg.ru	411240668	56	kpi-zpd	УП подготовки ЗИТ	active	t	2026-05-03 06:34:26.871817+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
0264938e-6877-41ca-b8d5-ad39df3ea83f	342	NuzhdovaZA	Жанна	Нуждова	NuzhdovaZA@mosreg.ru	961915053	58	kpi-zpd	УП подготовки ЗИТ	active	t	2026-05-03 06:34:31.804859+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
08ef4c23-98d5-4f07-bc6f-2774ec5f0def	209	LuzhakovaTI	Татьяна	Лужакова	LuzhakovaTI@mosreg.ru	292256751	86	kpi-iaa	УП анализа и автоматизации данных	active	t	2026-05-03 06:34:31.018288+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
09577c80-2e99-4fe3-a026-f6f0c3d912b6	304	KostrovaIV	Ирина	Кострова	KostrovaIV@mosreg.ru	216940944	5	kpi-org	УП организационного обеспечения	active	t	2026-05-03 06:34:30.317967+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
1552f862-0dce-4acf-98b5-5fc641cac114	182	ZabeyvorotaMA	Максим	Забейворота	ZabeyvorotaMA@mosreg.ru	1255416197	83	kpi-iaa	УП анализа и автоматизации данных	active	t	2026-05-03 06:34:34.286691+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
1654b246-1be5-49cd-afe2-7c6da1332cb7	398	KostinaDaM	Дарья	Костина	KostinaDaM@mosreg.ru	777916463	75	kpi-tsr	УП цифровой трансформации	active	t	2026-05-03 06:34:30.109714+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
1c31ac31-bd7e-437c-937b-4aa26d8446cc	441	BorisovDO	Данила	Борисов	BorisovDO@mosreg.ru	7980169119	29	kpi-feo	УП методологии развития ЕАСУЗ	active	t	2026-05-03 06:34:26.307077+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
214ecdea-2bc0-4ff6-93ba-80b1a870fb1b	91	FerrahLE	Людмила	Феррах	FerrahLE@mosreg.ru	727006728	91	kpi-iaa	УП анализа и автоматизации данных	active	t	2026-05-03 06:34:27.584071+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
23065b04-1486-4876-ac0f-7a4a93047d1f	156	AlekhinaAL	Александра	Алёхина	AlekhinaAL@mosreg.ru	472758997	45	kpi-kza	УП сопровождения корпоративных закупок	active	t	2026-05-03 06:34:25.140153+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
bfc3e323-90ed-4ac2-a363-406ee17e7774	454	BelovaNaEv	Наталья	Белова	BelovaNaEv@mosreg.ru	\N	9	kpi-org	УП организационного обеспечения	active	t	2026-05-03 06:34:25.72005+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
2298d6ac-ddfb-4c34-b0bf-b888281516ce	387	ErmakovaAnaIu	Анастасия	Ермакова	ErmakovaAnaIu@mosreg.ru	469082365	12	kpi-org	УП организационного обеспечения	dismissed	f	2026-04-19 14:45:08.530466+00	2026-04-14 18:02:33.279077+00	2026-04-24 17:18:25.587719+00
bbf62f57-c54b-4fe9-982f-f547a51d4b1b	338	IvanovaOkAl	Оксана	Иванова	IvanovaOkAl@mosreg.ru	1047391094	64	kpi-zpr	УП проведения, мониторинга и аналитики ЗИТ	active	t	2026-05-03 06:34:28.208938+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
bed56288-ca9a-4bcb-8c50-62211048845d	335	TeslinaAS	Анна	Теслина	TeslinaAS@mosreg.ru	822022549	63	kpi-zpr	УП проведения, мониторинга и аналитики ЗИТ	active	t	2026-05-03 06:34:33.336621+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
4b850f65-ead4-43e3-95f2-c75332043418	392	KolomytovRO	Руслан	Коломытов	KolomytovRO@mosreg.ru	234706222	75	kpi-tsr	УП цифровой трансформации	active	t	2026-05-03 06:34:29.254391+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
4bf2e9ab-5851-4f56-be2a-9be1f916bd5b	386	KornilovaElA	Корнилова	Елизавета	KornilovaElA@mosreg.ru	1025478569	70	kpi-zpr	УП проведения, мониторинга и аналитики ЗИТ	active	t	2026-05-03 06:34:29.752192+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
4df44ed1-52d2-40c6-99ea-4693652ab39b	66	DanilovaOS	Ольга	Данилова	DanilovaOS@mosreg.ru	386140273	88	kpi-iaa	УП анализа и автоматизации данных	active	t	2026-05-03 06:34:26.780249+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
5bcc9456-8ae8-46a3-ba33-948c2297d76e	448	BelozerovPA	Петр	Белозеров	BelozerovPA@mosreg.ru	259134916	39	kpi-pra	Правовое управление	active	t	2026-05-03 06:34:25.823653+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
5d19bde3-7dae-400c-ae35-0e481fed97e7	430	GasanovArSi	Артур	Гасанов	GasanovArSi@mosreg.ru	\N	35	kpi-pra	Правовое управление	active	t	2026-05-03 06:34:27.685465+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
65a420cd-70c2-41e1-9db0-796de6fa41b3	407	MutovkinPA	Пётр	Мутовкин	MutovkinPA@mosreg.ru	491253421	25	kpi-feo	УП методологии развития ЕАСУЗ	active	t	2026-05-03 06:34:31.703763+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
6602b5b6-72e3-4c2f-93ba-7a2318ffbfa1	373	ZaichkoVV	Валерий	Заичко	ZaichkoVV@mosreg.ru	307782709	4	kpi-ruk	Руководство	active	t	2026-05-03 06:34:34.437779+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
6bd7170e-ac07-4a00-b60d-02319058441a	16	VasilevaIrAl	Ирина 	Васильева	VasilevaIrAl@mosreg.ru	203185483	85	kpi-iaa	УП анализа и автоматизации данных	active	t	2026-05-03 06:34:33.847304+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
6bf17fb0-52cd-4502-8b7f-dc133de6fa4f	412	AgevninaViA	Виктория	Агевнина	AgevninaViA@mosreg.ru	390815799	77	kpi-tsr	УП цифровой трансформации	active	t	2026-05-03 06:34:25.023451+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
6cc18e18-af1a-441d-9637-a4d9bb4879a3	59	AlekseevaTaE	Татьяна	Алексеева	AlekseevaTaE@mosreg.ru	481513273	16	kpi-org	УП организационного обеспечения	active	t	2026-05-03 06:34:25.26584+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
727a98a0-4337-4d31-bb8a-4b4d1592cc0f	250	FedorovaNaMi	Наталья	Федорова	FedorovaNaMi@mosreg.ru	1133729142	11	kpi-org	УП организационного обеспечения	active	t	2026-05-03 06:34:27.312093+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
74bd5da7-80bf-46b8-891d-cc67598ee583	401	MelnikovaNatMi	Наталья	Мельникова	MelnikovaNatMi@mosreg.ru	1271036306	76	kpi-tsr	УП цифровой трансформации	active	t	2026-05-03 06:34:31.594296+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
76d7ea26-97cb-4962-9bd8-8a8ca7cea17d	408	GrebeniukovaES	Елизавета	Гребенюкова	GrebeniukovaES@mosreg.ru	527646900	60	kpi-zpd	УП подготовки ЗИТ	active	t	2026-05-03 06:34:27.954859+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
786c5190-9e17-4089-9760-8cb578e0e1f6	447	KhorkovaIuNi	Юлия	Хорькова	KhorkovaIuNi@mosreg.ru	847079600	32	kpi-pra	Правовое управление	active	t	2026-05-03 06:34:28.774064+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
795a81cf-a1d8-4760-a414-4244a5e765d2	437	ChebushevAnAl	Андрей	Чебушев	ChebushevAnAl@mosreg.ru	382997573	60	kpi-zpd	УП подготовки ЗИТ	active	t	2026-05-03 06:34:26.621742+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
7bedc894-c178-4878-a172-32443366941b	294	BolshakovaMI	Марина	Большакова	BolshakovaMI@mosreg.ru	402667853	13	kpi-org	УП организационного обеспечения	active	t	2026-05-03 06:34:26.197555+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
7cfbd8b7-27b5-4fa6-9d4b-c2cbf6bd0c4d	289	VinokurovMiA	Михаил	Винокуров	VinokurovMiA@mosreg.ru	261089867	71	kpi-tsr	УП цифровой трансформации	active	t	2026-05-03 06:34:34.006109+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
c561f92f-5155-45ec-8db5-a32b95d2609f	154	KhukhrinaEkE	Екатерина	Хухрина	KhukhrinaEkE@mosreg.ru	1079556628	21	kpi-feo	УП методологии развития ЕАСУЗ	active	t	2026-05-03 06:34:29.013458+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
c63a3d77-7431-488c-b622-571ad09653e2	251	IvanovaMaIg	Мария	Иванова	IvanovaMaIg@mosreg.ru	1425641145	86	kpi-iaa	УП анализа и автоматизации данных	active	t	2026-05-03 06:34:28.096442+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
ce6553e5-5d06-47cf-b1ae-6ec2e816c4c8	33	OsokinaGA	Галина	Осокина	OsokinaGA@mosreg.ru	1024116993	46	kpi-kza	УП сопровождения корпоративных закупок	active	t	2026-05-03 06:34:32.036264+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
cf210cf2-048a-4779-9697-c43ad3324f1c	391	ToroykinPO	Павел	Торойкин	ToroykinPO@mosreg.ru	411563577	79	kpi-tsr	УП цифровой трансформации	active	t	2026-05-03 06:34:33.472756+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
cff7b8ab-40e9-4ba7-be96-9d881a589259	255	PetrovaAnnIu	Анна	Петрова	PetrovaAnnIu@mosreg.ru	1037497074	81	kpi-iaa	УП анализа и автоматизации данных	active	t	2026-05-03 06:34:32.177643+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
d8aa37f5-d3ca-4137-a4e2-cecba59fddbf	416	GordienkoEG	Евгения	Гордиенко	GordienkoEG@mosreg.ru	536693319	56	kpi-zpd	УП подготовки ЗИТ	active	t	2026-05-03 06:34:27.845185+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
d9754b4c-b5a0-4a2a-aa74-7c34b9d80d1a	245	BaranovOlI	Олег	Баранов	BaranovOlI@mosreg.ru	879608328	86	kpi-iaa	УП анализа и автоматизации данных	active	t	2026-05-03 06:34:25.619261+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
dc517b91-fa61-4cac-b09f-1b179c42d2c7	353	SilakovSA	Сергей	Силаков	SilakovSA@mosreg.ru	234350003	74	kpi-tsr	УП цифровой трансформации	active	t	2026-05-03 06:34:33.117365+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
df245172-5284-49d5-ae1e-19ec1ae05bf1	449	KotelnikovVA	Виктор	Котельников	KotelnikovVA@mosreg.ru	8217622943	78	kpi-tsr	УП цифровой трансформации	active	t	2026-05-03 06:34:30.422439+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
df850b08-aee7-491c-bb88-0a52ffe5d14a	114	KomarovAnD	Андрей	Комаров	KomarovAnD@mosreg.ru	488279564	19	kpi-feo	УП методологии развития ЕАСУЗ	active	t	2026-05-03 06:34:29.397769+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
e344824a-3983-4624-b228-f9edb4cc5618	351	AbramovKiA	Кирилл	Абрамов	AbramovKiA@mosreg.ru	425780437	26	kpi-feo	УП методологии развития ЕАСУЗ	active	t	2026-05-03 06:34:24.708026+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
e78e953e-3b4b-4d60-b53e-2722fbb332d3	296	PoliakovNiD	Никита	Поляков	PoliakovNiD@mosreg.ru	986023365	20	kpi-feo	УП методологии развития ЕАСУЗ	active	t	2026-05-03 06:34:32.55362+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
e93abf35-f6ba-49f6-bc4b-0016521e285d	323	ShatalovaSA	Светлана	Шаталова 	ShatalovaSA@mosreg.ru	815006858	87	kpi-iaa	УП анализа и автоматизации данных	active	t	2026-05-03 06:34:32.848395+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
ed50f864-8935-4201-b15f-89fcb9189da1	370	KhromovaKN	Кристина	Хромова	KhromovaKN@mosreg.ru	407394836	52	kpi-zpd	УП подготовки ЗИТ	active	t	2026-05-03 06:34:28.886996+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
f8432b88-184d-4b8d-8aa3-478d03e2177e	111	AstakhovaAlD	Александра	Астахова	AstakhovaAlD@mosreg.ru	413636447	23	kpi-feo	УП методологии развития ЕАСУЗ	active	t	2026-05-03 06:34:25.489212+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
faddf639-e76c-43fa-9638-a7c11a15d2d3	445	EgorovaIriIv	Ирина	Егорова	EgorovaIriIv@mosreg.ru	\N	65	kpi-zpr	УП проведения, мониторинга и аналитики ЗИТ	active	t	2026-05-03 06:34:27.064017+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
fcde8e86-2b98-4e4d-9e2a-ab242a3eee63	32	KozlovDmS	Дмитрий	Козлов	KozlovDmS@mosreg.ru	252288208	48	kpi-kza	УП сопровождения корпоративных закупок	active	t	2026-05-03 06:34:30.670432+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
fe5bc603-79a3-456c-a0d6-e1ebf0e53313	305	TrushinaAnA	Анна	Трушина	TrushinaAnA@mosreg.ru	92998478	13	kpi-org	УП организационного обеспечения	active	t	2026-05-03 06:34:33.59041+00	2026-04-14 18:02:33.279077+00	2026-05-03 06:34:24.506149+00
\.


--
-- Data for Name: kpi_change_requests; Type: TABLE DATA; Schema: public; Owner: kpi_user
--

COPY public.kpi_change_requests (id, type, entity_id, payload, status, requested_by, reviewed_by, review_comment, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: kpi_criteria; Type: TABLE DATA; Schema: public; Owner: kpi_user
--

COPY public.kpi_criteria (id, indicator_id, criterion, numerator_label, denominator_label, thresholds, sub_indicators, quarterly_thresholds, cumulative, plan_value, common_text_positive, common_text_negative, created_at, sub_type, "order", value_label, is_quarterly, formula_desc) FROM stdin;
ae9bb236-650a-4836-a853-6b2dffd048a9	7a8940f7-f65e-4b73-a26b-0fd271f99378	Отсутствие нарушений по соблюдению установленных сроков и требований по рассмотрению обращений граждан	Соблюдение установленных сроков и требований по рассмотрению обращений граждан в отчетном периоде	\N	[{"score": 100.0, "conditions": ["Соблюдаются"]}, {"score": 0.0, "conditions": ["Не соблюдаются"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
1bf5bb4f-64e7-4e55-9897-a0d4c169b389	788f3eda-6413-46e4-8f26-13a248bc6ad3	Соблюдение Правил внутреннего трудового распорядка, Кодекса этики	Отсутствие нарушений внутреннего трудового распорядка, Кодекса этики	\N	[{"score": 100.0, "conditions": ["отсутствие"]}, {"score": 0.0, "conditions": ["наличие"]}]	null	null	f	100%	Правила внутреннего трудового распорядка и Кодекса этики соблюдаются в полном объёме.	Правила внутреннего трудового распорядка и Кодекса этики не соблюдаются в полном объёме.	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
b031b426-2732-496a-aeda-d6192c900757	b797cd20-8301-43e0-a8f8-54a658537b1b	Соблюдение правил и норм техники безопасности, охраны труда и противопожарного режима	Рассчитывается из фактического наличия	отсутствия нарушений	[{"score": 100.0, "conditions": ["Соблюдаются"]}, {"score": 0.0, "conditions": ["Не соблюдаются"]}]	null	null	f	100%	Правила и нормы техники безопасности, охраны труда и противопожарного режима соблюдаются в полном объёме.	Правила и нормы техники безопасности, охраны труда и противопожарного режима не соблюдаются в полном объёме.	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
a97fd204-36d9-4c9b-be91-4568b6d7b041	f2da6154-33a8-4f50-8317-7baa96e01502	Обеспечение принятия положительных решений Межведомственной комиссией по вопросам земельно-имущественных отношений в Московской области	100 - (количество отрицательных решений	количество рассмотренных комплектов документов*100)	[{"score": 100.0, "conditions": [">=90%"]}, {"score": 0.0, "conditions": ["<90%"]}]	null	null	f	90%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
de5879f6-d710-4ac3-87f9-b4394644479a	02ff8f25-e182-430c-b4c3-22e02f990506	Обеспечение конкуренции на конкурентных процедурах (чел/лот) (нарастающим итогом)	Количество заявителей (претендентов) по конкурентным процедурам	количество состоявшихся конкурентных процедур	[{"score": 100.0, "conditions": [">=3", "5"]}, {"score": 50.0, "conditions": ["˂3", "5; >=3", "1"]}, {"score": 0.0, "conditions": ["<3", "1"]}]	null	null	t	>=3,5	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
6c84df79-aada-493c-b35f-8ecf63b0ffb9	9b54640c-a571-4fb9-bcb3-3768ed4d5c5b	Обеспечение развития Государственной информационной системы Московской области «Единая автоматизированная система управления закупками»	Соответствие нормативно-правовых актов Российской Федерации, Московской области	\N	[{"score": 100.0, "conditions": ["Нет нарушений"]}, {"score": 0.0, "conditions": ["Есть нарушения"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
f1ad0f51-6818-44d9-af55-20768ab64197	6ea4c1fe-0408-47a5-b38d-0bddb9f1879c	Обеспечение деятельности \nпо информационной безопасности \nи защите информации	Отсутствие нарушений информационной безопасности и защита информации в Учреждении	\N	[{"score": 100.0, "conditions": ["Нет нарушений"]}, {"score": 0.0, "conditions": ["Есть нарушения"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
23aa2fa8-b5f0-499d-8430-a88567263127	8496f8d1-fb40-44c4-8046-ea6070a8a6d8	Обеспечение информационно-технической и технологической деятельности Учреждения	Отсутствие за отчетный период нарушений рабочего процесса Обеспечение администрирования информационных систем в актуальном состоянии	\N	[{"score": 100.0, "conditions": ["Нет нарушений"]}, {"score": 0.0, "conditions": ["Есть нарушения"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
2284cee3-9709-47a1-a3a5-a8b3e51de27f	6d6660e4-7c55-45d7-a8bd-aad933855458	Обеспечение реализации проектов цифровой трансформации	Отсутствие нарушения сроков реализации проектов цифровой трансформации	\N	[{"score": 100.0, "conditions": ["Нет нарушений"]}, {"score": 0.0, "conditions": ["Есть нарушения"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
8a2edda9-b5e2-4cb1-be55-597867d517b1	53099852-be21-4b46-b7b1-f33efa9e7445	Систематизация действующей структуры процессов, применяемых технологий и связей между ними	Поддержание в актуальном состоянии базы знаний бизнес-процессов	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
7c163300-f873-4d2f-bde2-e7cbf427e106	3e332410-3e15-4a8c-b3bd-74351e94ddd5	Обеспечение предоставления аналитической информации для принятия управленческих решений	Аналитические материалы предоставляются своевременно и отражают достоверные и точные данные	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
f7701bf4-988e-49c3-9a4d-ad44b31a6ec8	fc71cac0-b6ed-416d-a9af-e0fc192f36a4	Обеспечение своевременного заключения государственных контрактов в соответствии                               с Планом- графиком по результатам конкурентных (неконкурентных) процедур (в соответствии                          с утвержденным планом - графиком закупок) | Обеспечение своевременной приемки оказанных услуг, выполненных работ, поставленных товаров по заключенным государственным контрактам | Обеспечение надлежащего исполнения условий заключенных государственных контрактов | Обеспечение проведения закупочной                              деятельности в рамках утвержденных нормативных затрат	Кол-во заключенных государственных. контрактов	кол-во государственных контрактов в плане-графике закупок*100% | Кол-во своевременно принятых услуг, работ, товаров по государственным контрактам/кол-во заключенных государственных контрактов*100% | Кол-во своевременно исполненных государственных контрактов/кол-во заключенных государственных контрактов*100% | Соблюдение обеспечения проведения закупочной деятельности в рамках утвержденных нормативных затрат	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}, {"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
2585fde0-bfb3-4520-bf24-f1e7dc9ac64a	159bd802-31a1-484f-ba1d-cff5da969ae1	Отсутствия нарушения сроков исполнения документов Учреждением\n(внешний контроль) | Соблюдение установленных законом сроков подготовки ответов на поступившие в Учреждение обращения граждан (МСЭД, ЕЦУР, сайт и пр.) | Надлежащее и своевременное комплектование архива дел постоянного хранения, а также архива                                                                с выделением дел, не имеющих исторической ценности, подлежащих утилизации. | Надлежащее и своевременное комплектование архива дел постоянного хранения, а также архива                                                                с выделением дел, не имеющих исторической ценности, подлежащих утилизации.	Отсутствие нарушений сроков исполнения | Кол-во своевременно подготовленных ответов	кол-во поступившим обращениям*100% | Кол-во своевременно укомплектованных документов в архив/кол-во документов, по которым наступил срок сдачи в архив*100%	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
826ca25d-5a20-426d-9e75-8d1a99d8bda9	98f1a694-2b7c-4ac7-9bc6-922d91216812	Своевременное внесение изменений в нормативные затраты Учреждения, а также в Правила определения требований к закупаемым отдельным видам товаров, работ, услуг (Ведомственный перечень) за отчетный период	Кол-во внесенных изменений	кол-во документов-оснований  для внесения изменений*100 (В случае отсутствия оснований для внесения изменений «Значение» = 100%)	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
9c48a7fb-8f04-4e38-a0e7-82a1a6000191	abd8f253-6109-43f3-9b7f-f2154c99edf7	Своевременное (ежедневное)обновление информации на сайте Учреждения, в т.ч. полученной от профильных подразделений Учреждения	Соблюдение своевременного обновления информации на официальном сайте	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
41c49836-94bd-4b25-983b-b8992b6a59dc	ed8c11a7-cd21-484c-be06-b2ddd19ebe6a	Обеспечение своевременной и надлежащим образом зарегистрированной корреспонденции в Межведомственной системе электронного документооборота Московской области, в т.ч. ЗК (входящая, исходящая, внутренняя корреспонденция) | Обеспечение своевременного и качественного исполнения работниками Учреждения протокольных поручений (внутренний контроль) | Обеспечение соблюдения требований инструкции по делопроизводству при подготовке проектов документов, инициируемых в Учреждении	Кол-во своевременной регистрации документов	кол-во поступившей на регистрацию документов*100% (регистрация в день поступления документа) | Соблюдение исполнения работниками Учреждения протокольных поручений в отчетный период | Кол-во надлежаще проверенных проектов документов/ кол-во поступивших на проверку проектов документов*100%	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}, {"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
e1437ef3-95e4-4c37-9858-766fae8f7ae9	21fe0a29-3f97-426a-8be4-5f230a3299bf	Отсутствие составленных протоколов об административных правонарушениях, постановлений о привлечении к административной ответственности, предписаний об устранении нарушений, вступивших в законную силу судебных решений, предусматривающих взыскание денежных средств с Учреждения в области охраны труда и трудового законодательства	Рассчитывается из фактического наличия	отсутствия нарушений	[{"score": 100.0, "conditions": ["Отсутствие"]}, {"score": 0.0, "conditions": ["Наличие"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
9295be62-0ef8-49d7-a0d5-bedf804819c8	b92ac9eb-3d24-4044-9834-653aaa66524a	Отсутствие нарушений по соблюдению установленных сроков и требований по рассмотрению обращений граждан	Соблюдение установленных сроков и требований по рассмотрению обращений граждан в отчетном периоде	\N	[{"score": 100.0, "conditions": ["Соблюдаются"]}, {"score": 0.0, "conditions": ["Не соблюдаются"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
9298f166-0df8-4ba5-bfb1-801f752ad6ab	72bd3fe5-1423-421f-882c-4babc483b94a	Своевременное и надлежащее формирование и направление смет расходов бюджета Московской области. Внесение изменений в целях контроля и своевременного исполнения обязательств на обеспечение деятельности Учреждения | Контроль за рациональным использованием бюджетных средств	Кол-во своевременно и надлежаще сформированных и направленных смет расходов бюджета	общее кол-во смет расходов бюджета Московской области в части, касающейся Учреждения*100% | Недопущение нерационального использования бюджетных средств	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}, {"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
62dee10d-b3ae-41c1-b933-708b52800535	11d82078-6cb5-428d-af50-cff69855f84e	Своевременное оформление документов для инвентаризации | Достоверное отражение результатов инвентаризации	Кол-во своевременно подготовленных комплектов	общее кол-во подготовленных документов*100% | Соблюдается при условии отсутствия установлении контрольными, надзорными органами несоответствия результатов инвентаризации	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
6d8ab7e0-187b-46f1-a42c-5346151b8dfc	72219071-2fbf-4bd8-8d92-61bc2eca3309	Своевременное и надлежащее принятие бюджетных обязательств в соответствии с доведенными лимитами | Соблюдение срока оплаты бюджетных обязательств по государственным контрактам в пределах доведенных лимитов | Соблюдение срока оплаты бюджетных обязательств по государственным контрактам в пределах доведенных лимитов | Недопущение фактов нецелевого использования бюджетных средств	Обеспечение своевременного и надлежащего принятия бюджетных обязательств | Кол-во своевременно принятых бюджетных обязательств	кол-во поступивших документов-оснований*100% (не более двух рабочих дней от поступления документа-основания) | Соблюдается при отсутствии фактов нецелевого использования бюджетных средств	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
2fe76332-8eaf-433f-87e4-a9b1bb98e289	98f1a694-2b7c-4ac7-9bc6-922d91216812	Обеспечение надлежащего и своевременного исполнения \nплана-графика закупок в пределах доведенных лимитов за отчетный период	Кол-во своевременно опубликованных закупок	кол-во закупок по плану-графику*100% (В случае отсутствия публикаций закупок по плану-графику   «Значение» = 100%)	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
1a5b0430-fb62-4218-8bed-7979ea151596	a62f3183-a15f-4c51-bda8-9f9cf10ee2aa	Обеспечение своевременного и надлежащего исполнения условий заключенных государственных контрактов за отчетный период | Своевременное предоставление данных об оплате исполненных обязательств \nпо государственным контрактам за отчетный период	Кол-во своевременно опубликованных закупок	кол-во закупок по плану-графику*100% (В случае отсутствия публикаций закупок по плану-графику   «Значение» = 100%) | Предоставление информации  об оплате исполненных обязательств по государственным контрактам не позднее 11:00 часов (МСК) рабочего дня, следующего за днем подписания документа-основания для осуществления платежа	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}, {"score": 100.0, "conditions": ["Соблюдение"]}, {"score": 0.0, "conditions": ["Не соблюдение"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
15525b46-9d38-46d0-9903-63d9cb184401	602ce79b-f524-4656-81bf-5ba71bebfdce	Обеспечение не превышения доли несостоявшихся закупок от общего количества конкурентных закупок \n(нарастающим итогом) | Обеспечение среднего количества поданных заявок на участие в торгах (конкурентных процедурах) (нарастающим итогом) | Обеспечение объема закупок среди субъектов малого предпринимательства, социально ориентированных некоммерческих организаций (нарастающим итогом) | Обеспечение отсутствия обоснованных, частично обоснованных жалоб, поданных в ФАС России в отчетный период | Обеспечение не превышения доли стоимости контрактов, заключенных с единственным поставщиком по несостоявшимся закупкам (нарастающим итогом)	Количество объявленных торгов, на которые не было подано заявок, либо заявки были отклонены, либо подана одна заявка	общее количество объявленных торгов*100 | Общее количество поданных заявок на участие в торгах (конкурентных процедурах)/общее количество состоявшихся торгов (конкурентных процедур) (В случае отсутствия конкурентных закупок   «Значение» = 100%) | Сумма финансового обеспечения контрактов, заключенных  в соответствии с 44-ФЗ с СМП  или СОНО, утвержденного на отчетный год, включая контракты, заключенные до начала отчетного года/СГОЗ, утвержденный  на отчетный год *100   (В случае отсутствия закупок  в отчетном периоде  «Значение» = 100%) | Фактическое наличие/отсутствие в отчетном периоде обоснованных, частично обоснованных жалоб,  поданных в ФАС России	[{"score": 100.0, "conditions": ["1 кв. (мес.)  - <10% 2 кв. (мес.)  - <20% 3 кв. (мес.)  - <30% 4 кв. (мес.", "год) - <40%"]}, {"score": 0.0, "conditions": ["1 кв. (мес.) - >=10% 2 кв. (мес.)  - >=20% 3 кв. (мес.)  - >=30% 4 кв. (мес.", "год) - >=40%"]}, {"score": 100.0, "conditions": ["1 кв. (мес.)  - >=1", "5 2 кв. (мес.) - >=2", "5 3 кв. (мес.) - >=3", "5 4 кв. (мес.", "год)  - >=4"]}, {"score": 0.0, "conditions": ["1 кв. (мес.)  - <1", "5 2 кв. (мес.) - <2", "5 3 кв. (мес.) - <3", "5 4 кв. (мес.", "год) - <4"]}, {"score": 100.0, "conditions": ["1 кв. (мес.)  - >=15% 2 кв. (мес.)  - >=25% 3 кв. (мес.)  - >=35% 4 кв. (мес.", "год) - >=45%"]}, {"score": 0.0, "conditions": ["1 кв. (мес.)  - <15% 2 кв. (мес.)  - <25% 3 кв. (мес.)  - <35% 4 кв. (мес.", "год) - <45%"]}, {"score": 100.0, "conditions": ["Отсутствие"]}, {"score": 0.0, "conditions": ["Наличие"]}]	null	null	t	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
b261a9d0-33b6-489a-a6ec-bdf1d6861dfa	00b0c8fc-29a8-4783-8eb8-628adabce00f	Контроль и обеспечение передачи первичных учетных документов в ГКУ МО ЦБ МО в целях надлежащего начисления и выплаты заработной платы работникам Учреждения | Контроль передачи первичных учетных документов \nв ГКУ МО ЦБ МО в целях своевременного и надлежащего начисления иных выплат по заработной плате работникам Учреждения в соответствии с трудовым законодательством, приказами Учреждения | Контроль передачи первичных учетных документов \nв ГКУ МО ЦБ МО в целях своевременного отражения\n в бухгалтерском учете операций с подотчетными лицами	Соблюдение сроков качественного и своевременного направления первичных учетных документов в ГКУ МО ЦБ МО работником	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
a7f227d3-3fa0-486b-88ee-19c0bd4130c8	9ce10475-3a61-443b-a3e0-bb3f408fea29	Контроль за своевременным и надлежащим формированием и направлением ежемесячных, ежеквартальных, годовых форм отчетности по заработной плате в ИФНС, СФР, Росстат	Рассчитывается из числа своевременно направленных отчетов по заработной плате к общему числу отчетов, установленных законодательством Российской Федерации	\N	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
edab3cc1-15f4-4e7f-965e-cd0b47dfb3f3	cfbd58ae-8d53-4c14-8388-3328222ab69e	Своевременное оформление Приказов для выплат стимулирующего характера, произведение расчетов, указанных выплат и передача в ГКУ МО ЦБ МО | Контроль за своевременным начислением и выплатой стимулирующих выплат | Произведение сверки с фондами, ИФНС, ответы\n на требования и запросы	Соблюдение сроков и качества подготовки приказов (за 5 рабочих дней до начала события) | Отсутствие фактов несвоевременного начисления и выплат стимулирующих выплат | Кол-во проведенных сверок и ответов	общее кол-во сверок, поступивших запросов*100%	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}, {"score": 100.0, "conditions": ["Отсутствие"]}, {"score": 0.0, "conditions": ["Наличие"]}, {"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
cce6e478-1312-431b-86e5-d3ca41d882c4	e8bd6c80-3405-4639-99e3-6cf7039cfa3d	Соблюдение требований инструкции по делопроизводству при подготовке проектов документов, инициируемых в Учреждении, в т.ч. осуществлении проверки на орфографию и пунктуацию, а также их согласование	Кол-во надлежаще проверенных проектов документов	кол-во поступивших на проверку проектов документов*100%	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
654fd3b6-0bd9-428a-b228-2762e2938eeb	54ab991b-8cf2-44de-8f05-2c2a18b92a4c	Контроль кредиторской и дебиторской задолженности | Обеспечение надлежащего и своевременного\nпроведения финансового контроля | Контроль лимитов бюджетных обязательств \nна закупки для нужд Учреждения. Своевременное документальное оформление операций по обеспечению лимитами бюджетных обязательств на закупки для нужд Учреждения.	Своевременное выявление задолженности и принятие мер по ее уменьшению | Обеспечение проведения ежеквартального финансового контроля. Еженедельный внутренний контроль | Оформлено своевременно в соответствии с нормативами без нарушения сроков	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
30155225-fe5c-485d-a428-102d4113fad3	41e00483-fde9-4f6e-88be-3b06b9a0eaba	Соблюдение требований к закупаемым отдельным видам товаров, работ, услуг \nи установленных нормативных затрат при осуществлении закупок для нужд Учреждения	Требования к закупаемым отдельным видам товаров, работ, услуг и установленных нормативных затрат соблюдаются в полном объеме	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
f5422ae5-fe48-4435-900e-76cd7806c27c	fb740b15-7fce-441b-97f3-08d1ef494390	Контроль движения материальных ценностей Учреждения, их фактического наличия и состояния нефинансовых активов | Своевременное оформление и отражение хозяйственных операций по списанию нефинансовых активов Учреждения | Своевременное оформление и отражение хозяйственных операций по списанию нефинансовых активов Учреждения	Движение материальных ценностей оформляются установленным порядком | Оформление и отражение хозяйственных операций по списанию нефинансовых активов осуществляется в соответствии с законодательством РФ	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
4c3c26ae-ca3a-42c4-a4e8-db87a9d9902d	8167f3ce-9eec-46fb-8214-d7b5b6b04b48	Обеспечение своевременной и надлежащей подготовки кадровых документов (приказы: прием, увольнение, отпуска, переводы, табелей учета рабочего времени, исполнение графика отпусков и т.д.) | Своевременное и надлежащее обеспечение направления кадровой отчетности \nв СФР, ЦЗН и т.д.	Соблюдение порядка оформления и сроков, установленных законодательством Российской Федерации | Соблюдение сроков  в соответствии с трудовым законодательством Российской Федерации	\N	[{"score": 100.0, "conditions": ["соблюдается"]}, {"score": 0.0, "conditions": ["не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
9cc7d75c-89f4-45d6-8aaf-5743ebe24777	19a71e9c-5d5d-4336-87ba-9473103e5ff5	Отсутствие составленных протоколов об административных правонарушениях, постановлений о привлечении к административной ответственности, предписаний об устранении нарушений, вступивших в законную силу судебных решений, предусматривающих взыскание денежных средств с Учреждения (в области охраны труда и трудового законодательства)	Рассчитывается из фактического наличия	отсутствия нарушений	[{"score": 100.0, "conditions": ["отсутствие"]}, {"score": 0.0, "conditions": ["наличие"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
a1b01523-6a88-4e42-a80a-a8c6ec8e5cfd	349cff7c-981a-45ec-bd64-cadf37f0c221	Надлежащая организация воинского учета граждан, подлежащих воинскому учету, в том числе бронирование граждан, пребывающих в запасе (при необходимости)	Соблюдение порядка оформления и сроков, установленных законодательством Российской Федерации	\N	[{"score": 100.0, "conditions": ["Соблюдаются"]}, {"score": 0.0, "conditions": ["Не соблюдаются"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
05cbb922-173d-4504-abd9-2b176a32a3ab	e8bd6c80-3405-4639-99e3-6cf7039cfa3d	Своевременная и надлежащим образом зарегистрированная корреспонденция                                          в Межведомственной системе электронного документооборота Московской области, в т.ч. ЗК (входящая, исходящая, внутренняя), в том числе отсутствие ошибок при регистрации и подготовке проектов резолюций, и доведение ее по назначению до исполнителей, рассылка корреспонденции по назначению | Обеспечение своевременного и качественного  исполнения контрольных поручений директора, заместителей директора, начальников управлений  Учреждения (внутренний контроль) (МСЭД, ЗК, ЕЦУР и тд.), в т.ч исполнение контрольных сроков по обращениям граждан (МСЭД, ЕЦУР и тд.) | Обеспечение сбора и обработки статистических данных для подготовки отчетов по работе Отдела | Исполнение письменных и устных поручений непосредственного руководителя и вышестоящего руководства	Кол-во своевременной регистрации документов	кол-во поступившей на регистрацию документов*100% (регистрация в день поступления документа). Соблюдение надлежащего заполнения карточек документов | Кол-во обеспеченных исполнений контрольных поручений директора Учреждения/кол-во поставленных директором Учреждения поручений*100%. Обеспечение исполнение контрольных сроков по обращениям граждан | Своевременный сбор и обработка статистических данных | Надлежащее и своевременное исполнение указаний руководства Учреждения по закрепленному блоку в соответствии с должностной инструкцией и трудовым договором	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
f75a99ac-d8e9-4f6b-a977-14c829bf2162	ed8c11a7-cd21-484c-be06-b2ddd19ebe6a	Обеспечение своевременной и надлежащим образом зарегистрированной корреспонденции в Межведомственной системе электронного документооборота Московской области, в т.ч. ЗК (входящая, исходящая, внутренняя корреспонденция) | Обеспечение своевременного и качественного исполнения контрольных поручений директора Учреждения (внутренний контроль) | Обеспечение соблюдение требований инструкции по делопроизводству при подготовке проектов документов, инициируемых в Учреждении, в т.ч.                                            на орфографию и пунктуацию	Кол-во своевременной регистрации документов	кол-во поступившей на регистрацию документов*100% (регистрация в день поступления документа) | Кол-во обеспеченных исполнений контрольных поручений директора Учреждения/ кол-во поставленных директором Учреждения поручений*100% | Кол-во надлежаще проверенных проектов документов/ кол-во поступивших на проверку проектов документов*100%	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
ddb4c45b-195e-4e8b-86ba-42fc9a5dd1fd	84ea8532-c84b-46d0-b6f5-d0598cbcdb39	Отсутствие составленных протоколов об административных правонарушениях, постановлений о привлечении к административной ответственности, предписаний об устранении нарушений, вступивших в законную силу судебных решений, предусматривающих взыскание денежных средств с Учреждения (в области охраны труда и трудового законодательства) | Своевременная и надлежащая актуализация и подготовка ЛНА в области охраны труда (при необходимости)	Рассчитывается из фактического наличия	отсутствия нарушений | Отсутствие неактуальных ЛНА в области охраны труда, в том числе отсутствие замечаний по результатам проверок контрольных и надзорных органов	[{"score": 100.0, "conditions": ["отсутствие"]}, {"score": 0.0, "conditions": ["наличие"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
f654b26d-01fa-4b0c-8d2d-f86458e2d770	e8bd6c80-3405-4639-99e3-6cf7039cfa3d	Своевременная и надлежащим образом зарегистрированная корреспонденция                                          в Межведомственной системе электронного документооборота Московской области, в т.ч. ЗК (входящая, исходящая, внутренняя), в том числе отсутствие ошибок при регистрации и подготовке проектов резолюций, и доведение ее по назначению до исполнителей, рассылка корреспонденции   по назначению | Соблюдение требований инструкции по делопроизводству при подготовке проектов документов, инициируемых в Учреждении, в т.ч. осуществлении проверки на орфографию и пунктуацию, а также их согласование | Обеспечение своевременного и качественного  исполнения контрольных поручений директора, заместителей директора, начальников управлений  Учреждения (внутренний контроль) (МСЭД, ЗК, ЕЦУР и тд.), в т.ч исполнение контрольных сроков по обращениям граждан (МСЭД, ЕЦУР и тд.)	Кол-во своевременной регистрации документов	кол-во поступившей на регистрацию документов*100% (регистрация в день поступления документа). Соблюдение надлежащего заполнения карточек документов | Кол-во надлежаще проверенных проектов документов/кол-во поступивших на проверку проектов документов*100% | Кол-во обеспеченных исполнений контрольных поручений директора Учреждения/кол-во поставленных директором Учреждения поручений*100%. Обеспечение исполнение контрольных сроков по обращениям граждан	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
f097aa2a-669a-43af-8288-a4538769d5ce	e8bd6c80-3405-4639-99e3-6cf7039cfa3d	Соблюдение требований инструкции по делопроизводству при подготовке проектов документов, в т.ч. проверка орфографии и пунктуации, а также их согласование	Соблюдение требований инструкции по делопроизводству	\N	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
ba8230f3-620e-421f-9472-8774f615cb82	e8bd6c80-3405-4639-99e3-6cf7039cfa3d	Обеспечение своевременного и качественного исполнения контрольных поручений директора, заместителей директора, начальников управлений (МСЭД, ЗК, ЕЦУР и тд.), в т.ч. исполнение контрольных сроков по обращениям граждан	Своевременное исполнение контрольных поручений	\N	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
b8691711-26d4-4b04-ab93-9a79570f4be5	e8bd6c80-3405-4639-99e3-6cf7039cfa3d	Обеспечение сбора и обработки статистических данных для подготовки отчётов по работе Отдела | Исполнение письменных и устных поручений непосредственного руководителя и вышестоящего руководства	Своевременный сбор и обработка статистических данных | Надлежащее и своевременное исполнение указаний руководства Учреждения по закрепленному блоку в соответствии с должностной инструкцией и трудовым договором	\N	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
fadd1f75-e349-419d-b76e-ff15b350b523	bba045b2-258f-480c-95bc-0831c0cec21e	Соответствие подсистемы НПА	100% соответствие	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
60f07122-26fc-4442-9756-c4d3757b6ae6	5aa47867-1959-4521-ae5e-a56e4a3e9e03	Обеспечение подбора персонала требуемых квалификаций и специальностей	Кол-во устроенных на работу кандидатов	кол-во приглашенных кандидатов на собеседование*100%	[{"score": 100.0, "conditions": [">=10%"]}, {"score": 0.0, "conditions": ["<10%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
b55c952a-a4c0-4513-9d37-dd17d3cffe52	0acf0bcf-7297-42fd-931d-3470eb11fe85	Своевременная и надлежащая подготовка кадровых документов (приказы: прием, увольнение, отпуска, переводы и т.д.) | Своевременная подготовка табелей учета рабочего времени | Отсутствие нарушений по своевременному                                   и качественному направлению кадровой отчетности	Своевременная подготовка кадровых документов в соответствии с трудовым законодательством Российской Федерации | Соблюдение установленных сроков. Ежемесячно не позднее 15-го (не совпадении отчетного дня с выходным табель предоставляется в 1-ый рабочий день) и не позднее 1-го числа следующего за отчетным месяцем | Соблюдение сроков направления кадровой отчетности	\N	[{"score": 100.0, "conditions": ["Соблюдаются все сроки в полном объеме"]}, {"score": 0.0, "conditions": ["Сроки не соблюдаются"]}, {"score": 100.0, "conditions": ["Соблюдается полном объеме"]}, {"score": 0.0, "conditions": ["не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
9f14effc-21aa-4801-bb66-19523534cca1	52a82268-e352-4953-965f-b282350cc65d	Минимизация нарушений размещенных закупок в рамках 44-ФЗ	Минимизация нарушений размещенных закупок в рамках 44-ФЗ	\N	[{"score": 100.0, "conditions": ["Нет нарушений"]}, {"score": 0.0, "conditions": ["Есть нарушения"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
f95ffa10-f956-47b6-bb9d-3fcda3e292ab	cd5f98b5-a9f8-4720-a731-901039db3787	Своевременное и надлежащее формирование базы данных для предоставления аналитических отчетов	\N	\N	null	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
9bdc2009-28cb-4339-9418-8a8bb2ddbd52	3d5ddd26-a2d8-45e7-9d26-4436be18cdbd	Своевременное и надлежащее формирование аналитических отчетов	\N	\N	null	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
ec46fe5c-043b-4bbe-b305-a09a09ffd37c	d1a3708c-b0d1-4907-be6e-166c17d21f8d	Своевременная и надлежащим образом зарегистрированная корреспонденция в Межведомственной системе электронного документооборота Московской области, \nв т.ч. ЗК (входящая, исходящая, организационно-распорядительная), поступающая в Комитет по конкурентной политике Московской области, в том числе на бумажных носителях, в том числе отсутствие ошибок при регистрации и подготовке проектов резолюций, и доведение ее по назначению до исполнителей, рассылка корреспонденции по назначению | Своевременное материально-техническое обеспечение сотрудников Комитета по конкурентной политике Московской области в части выдачи и учета официальных бланков, канцелярских товаров, средств индивидуальной защиты	Кол-во своевременно зарегистрированных документов (регистрация в день поступления документа)	кол-во поступивших на регистрацию документов*100% | Выданы материально-технические ценности не позднее одного дня, следующего за соответствующим обращением/поступило обращений о выдаче материально-технических ценностей * 100%	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
1aba3471-449c-4b7a-8d3f-26ce69c1aa33	41a96d1c-812e-4022-9ccc-2f2c6197eff4	Своевременное материально-техническое обеспечение сотрудников Комитета в части выдачи и учёта официальных бланков, канцелярских товаров, средств индивидуальной защиты	Своевременное МТО сотрудников Комитета	\N	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
da182585-8847-4b27-b456-e4bfa6d5c368	41a96d1c-812e-4022-9ccc-2f2c6197eff4	Своевременное направление заявок по учётным записям сотрудников в МСЭД и ЗК МСЭД	Своевременные заявки по учётным записям в МСЭД	\N	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
c899a95b-9518-48a8-9f69-79839663d986	d1a3708c-b0d1-4907-be6e-166c17d21f8d	Надлежащее хранение и обеспечения сохранности архивных документов, своевременная подготовка к обработке документов постоянного срока хранения, к выделению к уничтожению архивных документов, не подлежащих хранению, своевременная выдача по запросам архивных копий и документов | Своевременное направление заявок по учетным записям сотрудников в МСЭД и ЗК МСЭД	Количество обработанных документов	количество поступивших документов *100% | Количество направленных заявок/количество поступивших обращений по учетным записям сотрудников в МСЭД и ЗК МСЭД *100%	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
8a6a6971-53c2-42ea-8a8e-592f69dd6a22	bba045b2-258f-480c-95bc-0831c0cec21e	Обеспечение своевременного предоставления (в рамках развития ЕАСУЗ) описаний задач по улучшению, доработке	Предоставление разработчику ТЗ  по улучшению	доработке  в установленный срок (не менее 2)	[{"score": 100.0, "conditions": ["Выполнено"]}, {"score": 0.0, "conditions": ["Не выполнено"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
f6a09f75-aa2d-4d40-ba0d-1b2afe2a39f7	d1a3708c-b0d1-4907-be6e-166c17d21f8d	Своевременная и надлежащим образом зарегистрированная корреспонденция в Межведомственной системе электронного документооборота Московской области, в т.ч. ЗК (входящая, исходящая, внутренняя, обращения граждан), поступающая в Комитет по конкурентной политике Московской области, в том числе отсутствие ошибок при регистрации и подготовке проектов резолюций, и доведение ее по назначению до исполнителей, рассылка корреспонденции по назначению | Своевременная и надлежащим образом зарегистрированная корреспонденция в государственной информационной системе Московской области «Единый центр управления регионом», поступающая в Комитет по конкурентной политике Московской области, в том числе отсутствие ошибок при регистрации и доведение ее по назначению до исполнителей (обращения граждан, поступившие по ЕЦУР- ПОС, ОНФ, Добродел)	Кол-во своевременной регистрации документов	кол-во поступившей на регистрацию документов*100% (регистрация в день поступления документа). Соблюдение надлежащего заполнения карточек документов	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
5a3757e7-397e-441f-ab79-fa643b17d8b6	41a96d1c-812e-4022-9ccc-2f2c6197eff4	Своевременная и надлежащим образом зарегистрированная корреспонденция в ГИС МО «Единый центр управления регионом» (ЕЦУР), в т.ч. обращения граждан (ЕЦУР-ПОС, ОНФ, Добродел)	Своевременная регистрация корреспонденции в ЕЦУР	\N	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
25d27846-e0b9-4160-ab83-933c8b55cd9c	41a96d1c-812e-4022-9ccc-2f2c6197eff4	Обеспечение сбора и обработки статистических данных для подготовки отчётов по работе Отдела	Сбор и обработка статистических данных для отчётов	\N	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
51f24e09-8be8-493f-8377-19a7268e5275	d1a3708c-b0d1-4907-be6e-166c17d21f8d	Обеспечение публикации информации обязательной для размещения на официальном сайте Комитета по конкурентной политике Московской области в информационной- коммуникационной сети «Интернет» | Обеспечение сбора и обработки статистических данных для подготовки отчетов по работе Отдела	Кол-во своевременных публикаций (в срок, указанный в заявках)	кол-во поступивших заявок на публикацию*100% | Своевременный сбор и обработка статистических данных	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
f66482fa-288a-4dd4-9439-4e178b645a68	9b54640c-a571-4fb9-bcb3-3768ed4d5c5b	Обеспечение развития подсистемы ЕАСУЗ	Соответствие подсистемы по НПА  и интеграционного взаимодействия ЕАСУЗ с Государственными информационными системами	\N	[{"score": 100.0, "conditions": ["Соблюдаются"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
9c77cee7-333a-4c1f-8903-e033c0745024	6d6660e4-7c55-45d7-a8bd-aad933855458	Отсутствие нарушения сроков реализации проектов	Отсутствие просрочек проектной деятельности в части касающейся	\N	[{"score": 100.0, "conditions": ["Выполнено"]}, {"score": 0.0, "conditions": ["Не выполнено"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
a7722065-0300-4190-8463-7748b09e5b6a	82fbb17a-be9d-441d-8dde-1da428e4a69e	Обеспечение развития подсистемы ЕАСУЗ	Соответствие подсистемы по НПА  и интеграционного взаимодействия ЕАСУЗ с Государственными информационными системами	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
e2846331-d195-4a0c-8d96-faf93407b510	d9aa6ebe-6215-4ada-b35e-302f4932707e	Отсутствие нарушения сроков реализации проектов	Отсутствие просрочек проектной деятельности в части касающейся	\N	[{"score": 100.0, "conditions": ["Выполнено"]}, {"score": 0.0, "conditions": ["Не выполнено"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
4ec74ea4-75c4-4f29-9ef6-bd99c639019f	90105cbc-ea6b-498a-bb5a-b0198817d796	Сопровождение пользователей ЕАСУЗ-44	Сопровождение пользователей ЕАСУЗ 44 - недопущение просрочек при рассмотрении обращений от пользователей	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
eef64a17-2ef9-4d3d-8b8e-2d1558885863	6d6660e4-7c55-45d7-a8bd-aad933855458	Развитие ЕАСУЗ-44 в соответствии с предложениями Комитета по конкурентной политике Московской области, пользователей и непосредственно необходимостью, в том числе, при изменении законодательства	Внесение предложений по улучшению системы, включая постановку задач на руководителя	\N	[{"score": 100.0, "conditions": ["Внесено"]}, {"score": 0.0, "conditions": ["Не внесено"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
71552712-f858-4c32-bcc7-5ec17df4b0db	6d6660e4-7c55-45d7-a8bd-aad933855458	Разработка и аналитика (до реализации) проектов по развитию ЕАСУЗ	Качественное предоставление проектов (аналитика) – минимум 1	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
376504fb-3349-4890-a2ca-d865d70e7433	867a139f-1901-4f5e-a8f3-f4dfb2fb00d1	Мониторинг/тестирование интеграционного взаимодействия ЕАСУЗ с Государственными информационными системами	100% соответствие интеграционного взаимодействия ЕАСУЗ с Государственными информационными системами	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
8a00daa4-3394-42fe-ad76-260d66b029e9	6d6660e4-7c55-45d7-a8bd-aad933855458	Обеспечение своевременного предоставления (в рамках развития ЕАСУЗ) описаний задач по улучшению, доработке	Предоставление разработчику ТЗ по улучшению	доработке в установленный срок (не менее 1)	[{"score": 100.0, "conditions": ["Выполнено"]}, {"score": 0.0, "conditions": ["Не выполнено"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
aad78807-f973-4d4c-9656-d6b86713447a	14114eba-5b29-4db9-88ce-4f99ced6fb34	Обеспечение методологической поддержки (взаимодействие) пользователей ЕАСУЗ	Сопровождение пользователей АРИП ЕАСУЗ - недопущение просрочек при рассмотрении заявок в СТП	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
fce01214-77fb-43c9-ac8c-17bbf57c2403	bba045b2-258f-480c-95bc-0831c0cec21e	Обеспечение методологической поддержки (взаимодействие) пользователей ЕАСУЗ	Сопровождение пользователей ЭМ - недопущение просрочек при рассмотрении обращений	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
0614e7cc-2201-4398-8de0-17c9b4e45738	6ea4c1fe-0408-47a5-b38d-0bddb9f1879c	Обеспечение соблюдения норм информационной безопасности	Обеспечение соблюдения норм информационной безопасности работников Учреждения	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
ff0482c4-b6d5-4f3b-9acd-2fbfa3c7d9e1	6ea4c1fe-0408-47a5-b38d-0bddb9f1879c	Выполнение плана мероприятий по информационной безопасности	Своевременное выполнение запланированных мероприятий Учреждения в части касающейся	\N	[{"score": 100.0, "conditions": ["Выполнено"]}, {"score": 0.0, "conditions": ["Не выполнено"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
d39f1e9d-2813-492c-9911-f872ce50265a	d1e6f2f6-7b2a-4d58-9894-be723bc0afe2	Информационно-техническое обеспечение деятельности Учреждения	Недопущение срыва рабочего процесса (своевременная выдача	замена техники) по запросу работников Учреждения	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
60d5ef00-b628-450d-af3f-9f86c76d0494	d1e6f2f6-7b2a-4d58-9894-be723bc0afe2	Обеспечение своевременной организации документооборота при оформлении ЭЦП	Своевременная подача заявлений на выдачу и блокировку ЭЦП работников Учреждения	\N	[{"score": 100.0, "conditions": ["Выполнено"]}, {"score": 0.0, "conditions": ["Не выполнено"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
bf6f4965-9a14-4d11-a577-ad266ff35c89	bba045b2-258f-480c-95bc-0831c0cec21e	Обеспечение методологической поддержки ЕАСУЗ	Соответствие подсистемы НПА	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
ea678c5f-4b51-4db2-bd60-8a00272f76f6	d1e6f2f6-7b2a-4d58-9894-be723bc0afe2	Предоставление информации о потребности товаров, работ, услуг для нужд Учреждения в рамках информационно-технологического обеспечения с описанием объекта закупки	Недопущение несвоевременного предоставления соответствующих сведений с учетом плана графика Учреждения	\N	[{"score": 100.0, "conditions": ["Соблюдаются"]}, {"score": 0.0, "conditions": ["Не соблюдаются"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
00367921-f169-480d-ad5e-265160b2705f	f91cf436-86a9-462b-879e-d46eb20744ce	Своевременное рассмотрение и подготовка правовых заключений по проектам НПА, принимаемых Правительством МО, или разработка проектов НПА, принимаемых Правительством МО \n(по мере возникновения оснований для внесения изменений)	Кол-во своевременно рассмотренных НПА и	или разработанных НПА и/или подготовленных правовых заключений/общее кол-во документов-оснований *100%	null	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
51135515-c5ee-468f-b1e6-1a1cdfee2fde	f173f4b9-abc5-412c-9f73-17f24335ccd2	Соблюдение сроков и качества подготовки ответов на обращения граждан, органов исполнительной власти, надзорных органов и иных организаций	Кол-во своевременно и качественно подготовленных ответов	общее кол-во поступивших обращений *100%	null	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
957b1cd1-7640-4689-89c3-12bf1e14d0e9	ce39cf54-effd-41bb-b1c9-71306611c75a	Своевременное пополнение локальными актами Учреждения внутренней правовой базы Учреждения (внесение приказов, изменений в них) по мере их выпуска	Рассчитывается количество внесенных нормативных правовых актов в правовую базу  из фактически изданных и зарегистрированных в Учреждении	\N	null	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
bda58b01-799c-433a-a235-f6851653692c	ba6bba4c-c116-4289-8ec5-2cd12b148878	Отсутствие фактов взыскания денежных средств с Учреждения по судебным спорам	Отсутствие фактического взыскания денежных средств с Учреждения по судебным спорам	\N	[{"score": 100.0, "conditions": ["Отсутствие"]}, {"score": 0.0, "conditions": ["Наличие"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
1c0bf8b9-a76d-4446-95aa-125ec58d2625	3fd7828f-995e-4894-bfb8-4ee8462af6bc	Отсутствие фактов выдачи предписаний контрольно-надзорных органов в отношении Учреждения в силу действий/бездействий Учреждения или Комитета по конкурентной политике Московской области	Фактическое наличие предписания контрольно-надзорных органов в отношении Учреждения в силу действий	бездействий Учреждения или Комитета по конкурентной политике Московской области	[{"score": 100.0, "conditions": ["Отсутствие"]}, {"score": 0.0, "conditions": ["Наличие"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
74be8119-ae4a-4a51-bf13-61ee701ca6ea	558d50d0-ee17-48da-826f-b3e76faed255	Отсутствие решений уполномоченного органа о привлечении Учреждения к административной ответственности в соответствии с КоАП РФ	Фактическое наличие вступившего в законную силу постановления о привлечении Учреждения к административной ответственности	\N	[{"score": 100.0, "conditions": ["Отсутствие"]}, {"score": 0.0, "conditions": ["Наличие"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
7c084476-5c04-446c-88f8-a83d6d69c825	73e28219-ac45-471d-96c2-da47a8cf298c	Своевременная и качественная правовая экспертиза поступающих в Отдел документов и оказание содействия структурным подразделениям в разработке проектов документов	Кол-во подготовленных правовых экспертиз	кол-во поступивших запросов*100%	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
3aaae7b2-4b33-4b34-a00d-7235e60dee4a	5e1c2ce2-a597-4bad-a22c-0e224d0e1135	Своевременный учет и аналитика реестра судебных дел, поступивших в Учреждения или Комитет по конкурентной политике Московской области	Кол-во поступивших судебных дел (иски, возражения, ходатайства, определения, другие процессуальные документы)	кол-во внесенных данных в реестр судебных дел *100%	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
b2948b87-e88d-4c4e-9dd8-2117cdaf2c7a	0eb1454a-191c-4288-b37e-d19a0de4657d	Обеспечение представления интересов Комитета по конкурентной политике Московской области и Учреждения в СОЮ и АС, на заседаниях комиссий Федеральной антимонопольной службы и ее территориальных органов в порядке, предусмотренном статьей 18.1 Федерального закона от 26.07.2006 № 135-ФЗ «О защите конкуренции» (при наличии уведомлений) | Обеспечение представления интересов Комитета по конкурентной политике Московской области и Учреждения в СОЮ и АС, на заседаниях комиссий Федеральной антимонопольной службы и ее территориальных органов в порядке, предусмотренном статьей 18.1 Федерального закона от 26.07.2006 № 135-ФЗ «О защите конкуренции» (при наличии уведомлений)	Доля проигранных дел в судах по торгам (кол-во проигранных судов	общее кол-во торгов*100%)	[{"score": 100.0, "conditions": ["<=0", "2"]}, {"score": 0.0, "conditions": [">0", "2"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
41b81eb0-2a66-4b3e-8bae-3cbdd453320b	9c917107-ad5a-4272-bd99-4480fbef796c	Своевременная и качественная подготовка еженедельных правовых обзоров в части организации и проведения земельно-имущественных торгов и закупочной деятельности в соответствии с Федеральным законом №223-ФЗ | Своевременная и качественная подготовка еженедельных правовых обзоров в части организации и проведения земельно-имущественных торгов и закупочной деятельности в соответствии с Федеральным законом №223-ФЗ	Рассчитывается из фактического наличия своевременных и качественных подготовленных обзоров в расчете 1 обзор в неделю	\N	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["0%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
0c01023c-3bc5-4fe1-bd0a-1d62a5d08be5	db791a71-da9b-4fc6-8dbe-903d43434a65	Обеспечение своевременной и надлежащей регистрации корреспонденции в Межведомственной системе электронного документооборота Московской области, в т.ч. ЗК (исходящая, внутренняя), в том числе отсутствие ошибок при регистрации, доведение ее по назначению до исполнителей и заинтересованных лиц, рассылка корреспонденции по назначению	Кол-во своевременной регистрации документов	кол-во поступивших на регистрацию документов*100% (регистрация в день поступления документа)	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
bcec6908-496d-4835-ab08-c5d0aa7ce686	a71fe6f2-273b-4359-a772-449bbf7efe6b	Обеспечение проведения совещаний, в том числе приглашение на межведомственные совещания и внутренние совещания, организуемых Комитетом по конкурентной политике Московской области, соответствующих участников	Обеспечение в полном объеме участия всех заинтересованных лиц в совещаниях	\N	[{"score": 100.0, "conditions": ["Обеспечено"]}, {"score": 0.0, "conditions": ["Не обеспечено"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
68fb09a3-d1fb-448e-84d6-3caf3d510c5a	02a925e2-3ff1-4437-9247-8b3e2578a1fc	Надлежащая подготовка и обеспечение принятия изменений в Типовое положение о закупках Московской области (223-ФЗ) (ТПоЗ) или распорядительных документов, относящихся к деятельности Учреждения	Рассчитывается из фактического наличия изданных локальных актов Учреждения (приказов), распоряжений Комитета по конкурентной политике Московской области	\N	[{"score": 100.0, "conditions": [">=3"]}, {"score": 0.0, "conditions": ["<3"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
fb0558e9-d20a-4690-aa19-e1458e0e16e9	2d66d372-0eff-48e9-b2d3-7fb06e8d2318	Разработка документов по гражданской обороне и действиям по предупреждению и ликвидации чрезвычайных ситуаций	Своевременная разработка и корректировка документов по гражданской обороне и действиям по предупреждению и ликвидации чрезвычайных ситуаций	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
38bf99d2-25c1-4474-a49a-478ff9823f8b	a0bf5434-e043-457a-947b-243dfa09e887	Своевременное внесение изменений в учредительные документы (по мере возникновения необходимости)	Внесение изменений в органы ФНС, своевременное уведомление об изменениях в соответствии с законодательством	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
f2210e4f-e73a-438f-8be9-802b1391139a	44268082-05f5-49f9-9af3-61b8d059ce12	Качественная и своевременная подготовка предложений по внесению изменений в НПА Московской области \n(по мере возникновения оснований для внесения изменений)	Кол-во представленных предложений	кол-во поступивших документов-оснований*100%	[{"score": 100.0, "conditions": [">=100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
f6e9720d-cd54-4ea6-9e02-b5eda62c4c9e	b0a22927-954b-48eb-8128-bb0361e28746	Осуществление мониторинга и еженедельный учет всех поступающих жалоб на закупочные процедуры заказчиков МО, осуществляющих закупочную деятельность в соответствии с Федеральным законом № 223-ФЗ	Рассчитывается из фактически подготовленных еженедельных отчетов	\N	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
9de1873b-84d4-48db-a4d4-3072d81ff184	499b8c99-019e-4198-b4fe-fdfd69890634	Обеспечение своевременного и качественного исполнения контрольных поручений руководства Комитета по конкурентной политике Московской области (внутренний контроль) (МСЭД, ЗК, ЕЦУР \nи тд.)	Кол-во обеспеченных исполнений контрольных поручений	кол-во поставленных поручений*100%.	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
419debb5-df07-4520-bc8f-c2631bd482cc	c9929604-138b-4998-a7db-d644b21e0991	Своевременное и надлежащее исполнение письменных и устных поручений непосредственного руководителя и вышестоящего руководства Учреждения и Комитета по конкурентной политике Московской области	Надлежащее и своевременное исполнение указаний руководства Учреждения и Комитета по конкурентной политике Московской области в соответствии с должностной инструкцией и трудовым договором	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
47f4a82c-e268-4705-ab27-1e7cc756648a	9a59cfbf-389e-43a5-9e78-17c315a759a6	Обеспечение размещения закупок посредством ЭМ ЕАСУЗ\n(общее значение показателя по МО)\n(нарастающим итогом)	Сумма договоров осуществляемых у ЕП заключенных в ЭМ	сумму заключенных договоров у ЕП*100% * Сумма в соответствии с п. 60.1.1, 60.1.2, 60.1.39. ТПоЗ.	[{"score": 100.0, "conditions": [">=90%"]}, {"score": 0.0, "conditions": ["<90%"]}]	null	null	t	90%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
583276c6-0b4e-4c2a-bd6a-ccd696fa4b1e	499af1e2-7ecd-41b6-a64f-1334ad07fd89	Обеспечить размещение закупок заказчиками Московской области через систему ЕАСУЗ не менее 95%\n(доля, %)\n(нарастающим итогом)	Кол-во закупок размещенных минуя ЕАСУЗ	общее количество опубликованных конкурентных закупок*100%	[{"score": 100.0, "conditions": [">=95%"]}, {"score": 0.0, "conditions": ["<95%"]}]	null	null	t	95%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
99f8c126-db2a-43ba-8fa7-f66b797666a7	499af1e2-7ecd-41b6-a64f-1334ad07fd89	Обеспечение заключения "Умных договоров" в ЕАСУЗ заказчиками МО\n(доля "Умных договоров")\n(нарастающим итогом)	Кол-во умных договоров	общее количество заключенных договоров*100%	[{"score": 100.0, "conditions": [">=90%"]}, {"score": 0.0, "conditions": ["<90%"]}]	null	null	t	90%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
9e7c9b69-e705-49bc-ad0b-ad017fc0e07f	c5e841f9-7320-413d-940b-65fa923f35d6	Обеспечение объема закупок у субъектов малого и среднего предпринимательства (СМСП) по закрепленному сектору \n(нарастающим итогом) | Обеспечение закупок в ЭМ ЕАСУЗ по закрепленному сектору \n(нарастающим итогом) | Обеспечение конкуренции при осуществлении закупок по закрепленному сектору \n(кол-во участников закупки): \nв 1 кв. (за месяцы) 2,7; 2 кв. (за месяцы) 3,0; 3 кв. (за месяцы) 3,3; 4 кв. (за месяцы/за год) 3,6 | Обеспечения отсутствия обоснованных (частично обоснованных) жалоб по закрепленному сектору (доля жалоб):  \nне более 1%\n(нарастающим итогом) | Обеспечения объема закупок конкурентными способами, осуществляемых заказчиками по закрепленному сектору\n(нарастающим итогом)	Кол-во закупок у СМСП	кол-во общего числа закупок*100% | Сумма договоров осуществляемых у ЕП заключенных в ЭМ/сумму заключенных договоров у ЕП*100% * Сумма в соответствии с пп. 60.1.1, 60.1.2, 60.1.39. ТПоЗ. | Общее количество участников конкурентных процедур/Общее количество конкурентных процедур | Кол-во жалоб признанных обоснованными (частично обоснованными)/кол-во опубликованных конкурентных процедур*100% | Сумма закупок, осуществленных конкурентным способом/общая сумма закупок*100%* * При расчете показателя не учитываются закупки коммунальных услуг у единственного поставщика в соответствии с п. 60.1.3, 60.1.4, 60.1.5, 60.1.6, 60.1.41 Положения о закупке.	[{"score": 100.0, "conditions": [">=65%"]}, {"score": 0.0, "conditions": ["<65%"]}, {"score": 100.0, "conditions": [">=90%"]}, {"score": 0.0, "conditions": ["<90%"]}, {"score": 100.0, "conditions": ["1 кв.- >=2", "7 2 кв.- >=3", "0 3 кв.- >=3", "3 4 кв.(год)- >=3", "6"]}, {"score": 0.0, "conditions": ["1 кв.- <2", "7 2 кв.- <3", "0 3 кв.- <3", "3 4 кв.(год)- <3", "6"]}, {"score": 100.0, "conditions": ["<1"]}, {"score": 0.0, "conditions": [">=1"]}, {"score": 100.0, "conditions": [">=67%"]}, {"score": 0.0, "conditions": ["<67%"]}]	null	null	t	65%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
b9a8df16-fa32-4bdf-a438-9349bd440189	59aba96f-85a4-432a-b9d2-3eee9d95a904	Обеспечения отсутствия обоснованных (частично обоснованных) жалоб по МО \n(доля жалоб):  \nне более 1%\n(нарастающим итогом)	Кол-во жалоб признанных обоснованными (частично обоснованными)	кол-во опубликованных конкурентных процедур*100%	[{"score": 100.0, "conditions": ["<1%"]}, {"score": 0.0, "conditions": [">=1%"]}]	null	null	t	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
c76b96d6-f59f-4004-80fd-206af9f41ba3	f78f6f58-11bc-473e-ba2f-5481174ef5d4	Обеспечение доли выданных положительных заключений по плану закупок в отношении заказчиков, согласно Распоряжению Правительства РФ № 717-Р и ПП РФ № 1169 не менее 90%\n(доля, %)\n(за отчётный период)	Кол-во выданных уведомлений(заключений) о несоответствии	общее кол-во выданных заключений*100%	[{"score": 100.0, "conditions": [">=90%"]}, {"score": 0.0, "conditions": ["<90%"]}]	null	null	f	90%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
ad8cc4f8-c14c-4b22-b6d2-9563e718bdc7	8550a4cc-620a-4579-825e-fd24b3c60513	Своевременная выдача заключений по плану закупок в отношении заказчиков, согласно Распоряжению Правительства РФ № 717-Р и ПП РФ № 1169	Кол-во планов закупок	10 планов закупки *Количество рабочих дней в отчетный период	[{"score": 100.0, "conditions": [">норматива"]}, {"score": 0.0, "conditions": ["<норматива"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
d658b01f-715e-4030-b249-995e48ad6c20	c5e841f9-7320-413d-940b-65fa923f35d6	Обеспечение объема закупок у субъектов малого и среднего предпринимательства (СМСП) по закрепленному сектору \n(нарастающим итогом) | Обеспечение закупок в ЭМ ЕАСУЗ по закрепленному сектору \n(нарастающим итогом) | Обеспечение конкуренции при осуществлении закупок по закрепленному сектору \n(кол-во участников закупки): \nв 1 кв. (за месяцы) 2,7; 2 кв. (за месяцы) 3,0; 3 кв. (за месяцы) 3,3; 4 кв. (за месяцы/за год) 3,6 | Обеспечения отсутствия обоснованных (частично обоснованных) жалоб по закрепленному сектору (доля жалоб):  \nне более 1%\n(нарастающим итогом) | Обеспечения объема закупок конкурентными способами, осуществляемых заказчиками по закрепленному сектору\n(нарастающим итогом) | Обеспечения объема закупок конкурентными способами, осуществляемых заказчиками по закрепленному сектору\n(нарастающим итогом)	Кол-во закупок у СМСП	кол-во общего числа закупок*100% | Сумма договоров осуществляемых у ЕП заключенных в ЭМ/сумму заключенных договоров у ЕП*100% * Сумма в соответствии с пп. 60.1.1, 60.1.2, 60.1.39. ТПоЗ. | Общее количество участников конкурентных процедур/Общее количество конкурентных процедур | Кол-во жалоб признанных обоснованными (частично обоснованными)/кол-во опубликованных конкурентных процедур*100% | Сумма закупок, осуществленных конкурентным способом/общая сумма закупок*100%* * При расчете показателя не учитываются закупки коммунальных услуг у единственного поставщика в соответствии с п. 60.1.3, 60.1.4, 60.1.5, 60.1.6, 60.1.41 Положения о закупке.	[{"score": 100.0, "conditions": [">=65%"]}, {"score": 0.0, "conditions": ["<65%"]}, {"score": 100.0, "conditions": [">=90%"]}, {"score": 0.0, "conditions": ["<90%"]}, {"score": 100.0, "conditions": ["1 кв.- >=2", "7 2 кв.- >=3", "0 3 кв.- >=3", "3 4 кв.(год)- >=3", "6"]}, {"score": 0.0, "conditions": ["1 кв.- <2", "7 2 кв.- <3", "0 3 кв.- <3", "3 4 кв.(год)- <3", "6"]}, {"score": 100.0, "conditions": ["<1"]}, {"score": 0.0, "conditions": [">=1"]}, {"score": 100.0, "conditions": [">=67%"]}, {"score": 0.0, "conditions": ["<67%"]}]	null	null	t	65%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
8c849898-b090-4f23-9b0d-72f0f8fa3ecc	ebe7ae0b-4e77-46fe-8330-0d9b786eef61	Обеспечение мониторинга конкурентных закупок за счет средств бюджета	Кол-во закупок	8 закупок *Количество рабочих дней в отчетный период	[{"score": 100.0, "conditions": [">норматива"]}, {"score": 0.0, "conditions": ["<норматива"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
12f5197f-9150-4f49-acff-d3cad1512a42	6d6660e4-7c55-45d7-a8bd-aad933855458	Соблюдение сроков проектов	Соблюдение сроков проектов	\N	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
3676a4a5-5908-49e5-8246-4623711ab35c	dc2c5e07-90c6-4179-be98-c89d66fe2b53	Обеспечение своевременного размещения отчетности заказчиками МО  \n(доля, не мене 90%) \n(за отчётный период)	Кол-во заказчиков, своевременно разместивших отчет	общее кол-во активных заказчиков МО*100	[{"score": 100.0, "conditions": [">=90%"]}, {"score": 0.0, "conditions": ["<90%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
fbc09ac2-6e1b-45b9-b784-d5a9f24d9353	cf044e19-6b14-4956-b3f4-82fa31927487	Своевременное и всестороннее рассмотрение закупок/позиций плана\n(количество рассмотренных закупок/позиций плана)	Кол-во закупок	7 закупок *Количество рабочих дней в отчетный период	[{"score": 100.0, "conditions": [">норматива"]}, {"score": 0.0, "conditions": ["< норматива"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
117dbbb2-b8d9-4c12-bfcf-584e696405d7	13faee05-a8b0-4bf1-9d24-a894b570ff27	Обеспечение мониторинга закупок у единственного поставщика на предмет обоснования способа проведения и предотвращения дробления\n(доля, не мене 90%)\n(за отчётный период)	Кол-во обоснованно проведенных закупок у ед. поставщика	общее кол-во проведенных закупок у ед. поставщика*100	[{"score": 100.0, "conditions": [">=90%"]}, {"score": 0.0, "conditions": ["<90%"]}]	null	null	f	90%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
cba0d6d6-d7f0-4046-bc7d-7603609c0f3a	4dac7f69-686f-47b6-b3c5-6fdf053b97fc	Обеспечение качественного и своевременного выставления запланированных объектов на торги (млн.) \nв соответствии с потребностью планируемых поступлений в бюджеты ОМСУ по результатам проведения торгов, указанной в АРИП ЕАСУЗ МО, за отчетный период	Фактическое значение по публикации торгов (млн. руб.)	Плановое значение по публикации торгов (млн руб.)*100	[{"score": 100.0, "conditions": [">=80%"]}, {"score": 0.0, "conditions": ["<80%"]}]	null	null	f	80%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
153deb3b-53df-401d-a2dd-e073b89f8080	be29de82-88f2-4b81-af9d-75f78aef670b	Обеспечение качественного и своевременного выставления запланированных объектов на торги (лоты) \nв соответствии с Методическими рекомендациями по формированию плана торгов в Московской области от 08.10.2024 № 31Исх-3921/24-02, за отчетный период	Фактическое значение по публикации торгов (млн. руб.)	Плановое значение по публикации торгов (млн руб.)*100	[{"score": 100.0, "conditions": [">=80%"]}, {"score": 0.0, "conditions": ["<80%"]}]	null	null	f	80%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
67db4498-bd3d-46fd-bb5b-b878abf376b8	008e6517-8106-462b-a54d-f68c9f92919d	Обеспечение своевременного направления согласованных на МВК комплектов документов по объектам для публикации торгов	Количество направленных комплектов документов	количество согласованных комплектов документов*100	[{"score": 100.0, "conditions": [">=80%"]}, {"score": 0.0, "conditions": ["<80%"]}]	null	null	f	80%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
270e7d90-e577-48dc-82ef-15bb6993409e	23186bd9-70e1-4461-b0f1-e6f7b0518584	Обеспечение своевременной подготовки заключений по конкурентным процедурам в Московской области, размещаемым на официальном сайте торгов не Комитета по конкурентной политике Московской области/Учреждения	Количество рассмотренных конкурентных процедур	количество выявленных конкурентных процедур *100	[{"score": 100.0, "conditions": [">=95%"]}, {"score": 0.0, "conditions": ["<95%"]}]	null	null	f	95%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
c1cb23e6-d8fd-46db-8a48-4b0372d71236	054de95b-5f8e-4fd2-9021-0249fadd1774	Обеспечение публикации торгов, направленных центральными исполнительными органами Московской области и органами местного самоуправления муниципальных образований Московской области	Количество опубликованных торгов	количество направленных комплектов документов*100	[{"score": 100.0, "conditions": [">=95%"]}, {"score": 0.0, "conditions": ["<95%"]}]	null	null	f	95%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
04d7c449-cc31-41ed-8032-89aca7cb52bd	29da3e50-0e13-4f30-8b21-6913c2d8bbdc	Обеспечение качественного и своевременного рассмотрения документов на Межведомственной комиссии по вопросам земельно-имущественных отношений в Московской области	Количество рассмотренных комплектов документов	количество направленных комплектов документов *100	[{"score": 100.0, "conditions": [">=90%"]}, {"score": 0.0, "conditions": ["<90%"]}]	null	null	f	90%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
0c9747ce-d009-4800-8a92-4011862740dc	5b22297d-439a-4b3e-a983-b8ae8c56182e	Обеспечение своевременного рассмотрения документов по нежилым помещениям, направленным для публикации торгов	Количество рассмотренных комплектов документов	количество направленных комплектов документов*100	[{"score": 100.0, "conditions": [">=90%"]}, {"score": 0.0, "conditions": ["<90%"]}]	null	null	f	90%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
b781a8aa-266d-4978-9436-b400ff362460	00a70b21-0ca0-4073-905b-ec50655fb4c5	Обеспечение качественного и своевременного рассмотрения документов на МВК (лотов) | Обеспечение качественной и своевременной публикации торгов (лотов)	>=12 лотов	р.д. | >=6 лотов/р.д.	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
06c90931-d0ca-42e3-8a71-90dd4a3ad342	ab98a411-75c8-46e8-acf5-4a9de148602c	Обеспечение качественного и своевременного рассмотрения документов на Межведомственной комиссии по вопросам земельно-имущественных отношений в Московской области	Количество согласованных комплектов документов на МВК	Количество направленных комплектов документов на МВК*100	[{"score": 100.0, "conditions": [">=85%"]}, {"score": 0.0, "conditions": ["<85%"]}]	null	null	f	85%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
20f68dd6-e7d8-40f4-9287-2c65529fb0f2	9c0e74df-6264-4834-9ef6-3f71ebce7196	Обеспечение своевременного мониторинга решений, принятых Межведомственной комиссией по вопросам земельно-имущественных отношений в Московской области	Количество проверенных СЗ, Протоколов МИО	Количество направленных СЗ/Протоколов МИО*100	[{"score": 100.0, "conditions": [">=95%"]}, {"score": 0.0, "conditions": ["<95%"]}]	null	null	f	95%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
057e00ab-c174-420b-94f2-842ed67aee00	4927f4a6-894b-4053-95cd-1f21a9afeb8c	Обеспечение качественного и своевременного рассмотрения документов на МВК (земельные участки коммерческого назначения)	Количество рассмотренных комплектов документов на МВК (коммерческие ЗУ)	Количество направленных комплектов документов на МВК (коммерческие ЗУ)*100	[{"score": 100.0, "conditions": [">=85%"]}, {"score": 0.0, "conditions": ["<85%"]}]	null	null	f	85%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
2dba60e5-8c49-4535-af85-3cb35c79fba5	ad2368f8-342e-4bbe-a2d2-92371c0dfb45	Обеспечение доли конкурентных процедур \nпо земельно-имущественным торгам\n(нарастающим итогом)	Количество состоявшихся конкурентных процедур	количество реализованных лотов*100	[{"score": 100.0, "conditions": [">=45%"]}, {"score": 0.0, "conditions": ["<45%"]}]	null	null	t	45%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
abee1d21-cfa6-49ca-b141-e07c006b45d4	6e2c6c81-831e-4587-b5dc-20fe02e20a8d	Обеспечение своевременного и надлежащего направления материалов для разработки позиции по объявленным/проведенным ЗИТ\n(за отчетный период)	Количество направленных материалов	общее количество поступивших исковых заявлений/жалоб УФАС*100	[{"score": 100.0, "conditions": [">=95%"]}, {"score": 0.0, "conditions": ["<95%"]}]	null	null	f	95%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
a562abd0-27cb-4a36-a3c6-3193f0839977	128e2024-c153-461d-b1bd-4309c5a0ed8b	Обеспечение % превышения начальных цен на земельно-имущественных торгах\n(нарастающим итогом)	Сумма итоговых цен	Сумма начальных цен*100-100	[{"score": 100.0, "conditions": [">50%"]}, {"score": 0.0, "conditions": ["<=50%"]}]	null	null	t	>=60%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
1a6779b1-2a56-4f41-9f46-a7fb26757f03	b0ef4a16-2947-49cb-bfb4-8c2aafc1b7fe	Обеспечение своевременной подготовки информационных материалов по популяризации торгов (за отчетный период)	Обеспечение достижения подготовки информационных материалов по популяризации торгов не менее 22 за отчетный период (месяц)	\N	[{"score": 100.0, "conditions": [">22"]}, {"score": 50.0, "conditions": ["=22"]}, {"score": 0.0, "conditions": ["<22"]}]	null	null	f	>22	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
53f34714-ae1a-4d8f-9973-a2eb26587b24	be921cd5-fd9e-40ec-b9b4-8202af8b0cc5	Обеспечение своевременного и надлежащего направления ответов на запросы\n(за отчетный период)	Количество направленных ответов на запросы	количество поступивших запросов*100	[{"score": 100.0, "conditions": [">=95%"]}, {"score": 0.0, "conditions": ["<95%"]}]	null	null	f	95%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
0090ba2d-4e53-4e5e-948a-a038462f3a84	0926b6a9-5d8c-4eab-9335-fd5ce60faf7b	Обеспечение своевременного и качественного внесения изменений по объявленным торгам\n(за отчетный период)	Количество оформленных в установленном порядке внесенных изменений в процедуру торгов	количество запланированных к внесению изменений процедур торгов*100	[{"score": 100.0, "conditions": [">=95%"]}, {"score": 0.0, "conditions": ["<95%"]}]	null	null	f	95%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
74aea696-15eb-4252-acb1-38a503db34cc	8b786300-9853-437d-bb8b-8361466d6df4	Обеспечение своевременной и качественной подготовки аналитических материалов по объявленным/проведенным ЗИТ	Обеспечение достижения подготовки аналитических материалов не менее 16 за отчетный период (месяц)	\N	[{"score": 100.0, "conditions": [">16"]}, {"score": 50.0, "conditions": ["=16"]}, {"score": 0.0, "conditions": ["<16"]}]	null	null	f	>16	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
18336036-712d-47d4-b22c-d3750e948b23	8791431f-82bd-477b-b4c9-a9b5211f8c50	Обеспечение предоставления ответов на запросы по торгам | Обеспечение внесения изменений по объявленным торгам | Обеспечение мониторинга ЗИТ, ведение ежедневного учёта | Обеспечение ежедневной аналитики ЗИТ	>=13,2	р.д. | >=24/р.д. | ежедневно | ежедневно	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
6e8ead73-fbe1-4eed-ac92-89efe88d1150	7faf144d-78ee-40f4-b9dc-aa5bb18a567a	Обеспечение доступных условий участия \nв земельно-имущественных торгах\n(за отчетный период)	Количество участников в ЗИТ	количество поданных заявок для участия в ЗИТ*100	[{"score": 100.0, "conditions": [">=96", "5%"]}, {"score": 50.0, "conditions": ["<96", "5%; >=96", "3%"]}, {"score": 0.0, "conditions": ["<96", "3%"]}]	null	null	f	>=96,5%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
92754a0b-98ad-4582-b23d-83144ecc2bcf	6a947471-7f6d-4951-b7fd-129e7e0824ad	Обеспечение своевременного включения лиц, уклонившихся от заключения договора, в реестр недобросовестных участников\n(за отчетный период)	Количество лиц, сведения о которых направлены для включения в РНУ	Количество лиц, уклонившихся от заключения договора, сведения о которых направлены в УФАС для включения в РНУ *100 (В случае отсутствия лиц, уклонившихся от заключения договора, за отчетный период «Значение» = 100%)	[{"score": 100.0, "conditions": [">=95%"]}, {"score": 0.0, "conditions": ["<95%"]}]	null	null	f	95%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
0ce2acfd-cee5-49dc-b69e-3ddb9c2a665d	1e1ca628-dae1-4efb-be74-d379c553eb75	Обеспечение своевременного заключения договоров по итогам земельно-имущественных торгов\n(нарастающим итогом)	Кол-во заключенных договоров	кол-во торгов, срок на заключение договоров по которым истек*100	[{"score": 100.0, "conditions": [">=95%"]}, {"score": 0.0, "conditions": ["<95%"]}]	null	null	t	95%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
af09efff-a517-454f-8673-242c70398592	b0e95aea-5cb3-4f25-85b8-f6f7b7394217	Обеспечение качественного и своевременного проведения заседаний комиссий по ЗИТ | Мониторинг заключения договоров по итогам земельно-имущественных торгов	>=14 заявок	р.д. | >=7,6 торгов/р.д.	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
c3eaee66-6e83-4550-9692-e126f76b5554	6d6660e4-7c55-45d7-a8bd-aad933855458	Составление детальных планов реализации проектов цифровой трансформации и обеспечение их выполнения	Для каждого проекта разработан план его реализации и осуществляется контроль его выполнения	\N	[{"score": 100.0, "conditions": ["Соблюдаются"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
21d5ed08-eed0-4631-8400-1bb74e502787	d0d3c706-c94c-49f5-8d6b-ecfabd63f364	Контроль реализации моделирования бизнес-процессов	Проведены анализ и моделирование внутренних и внешних процессов, исследование регулярно повторяющихся рутинных операций, ранжирование процессов по степени важности и влияния на результат	\N	[{"score": 100.0, "conditions": ["Соблюдаются"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
8ade59bc-6d6e-4d88-9756-a12954112035	91aa04c3-0c94-4a65-aadc-4bfd36b3fc3f	Сбор и систематизация данных о ходе проектов цифровой трансформации, подготовка регулярных отчетов руководству	Представленная информация о проекте отражает реальную картину процесса его реализации. Соблюдены сроки предоставления отчетности	\N	[{"score": 100.0, "conditions": ["Соблюдаются"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
131faa4a-7d60-47b4-bd1e-b253f9b1bf91	16b1cc80-0b99-4f59-9b59-722b329fb952	Обеспечение внедрения и развития принципов клиентоцентричности	Соответствие реализованных задач утвержденной дорожной карте	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
9c15528b-b8ab-4420-8554-e3c50720bddf	baad0426-5c07-4980-9e79-a8ad93c4c7c7	Разработка/поддержание в актуальном состоянии НПА и прочей документации для реализации федерального проекта «Государство для людей»	Наличие необходимых НПА	документов для реализации задач федерального проекта «Государство для людей»	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
9b32cdad-aed6-4f3e-834f-c66d88d0ab7d	8fe5e8a6-5a3d-4465-9e9d-64095c0affed	Детальное описания и визуальное отображения всех процессов, с использованием специализированных инструментальных средств моделирования.	Все детали процессов отражены в моделях с высокой степенью детализации, что позволяет видеть полную структуру выполняемых функций и взаимодействий между ними	\N	[{"score": 50.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}, {"score": 50.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
66b5ad4c-3585-45e9-8daf-a2150609e38f	2398622c-298f-4841-ae81-5b54f660609b	Поддержание и развитие стандартов построения моделей бизнес-процессов	Моделирование процессов происходит в соответствии с разработанными стандартами	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 100.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
1b0eae8a-c070-4842-814c-b3f0e50f9902	3e332410-3e15-4a8c-b3bd-74351e94ddd5	Подготовка аналитических материалов, справок и докладов по вопросам, относящимся к компетенции отдела	Своевременное и надлежащее формирование данных и аналитических материалов в части компетенции отдела	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
cf62cef5-fb17-4277-89eb-f54f66b2ebe4	0296cbf2-b1f4-4d94-962e-6ba0d88a7d65	Поддержание в актуальном состоянии структуры КОЗ, обеспечения целостности, сохранности и эффективности его использования | Обеспечение обработки поступающих запросов пользователей ЕАСУЗ на перестройку структуры КОЗ	База данных КОЗ находится в актуальном состоянии.  Данные соответствуют текущей версии КОЗ и не противоречат стандартам национальной системы стандартизации. Целостность КОЗ не нарушена. | Запросы пользователей обработаны в срок. Данные КОЗ обновлены. Целостность КОЗ не нарушена.	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
4c7853a0-3b7e-46e5-a70c-293b6b281c8f	2101e201-9fe6-496e-ac66-ae6a895ce238	Обеспечение обработки поступающих запросов пользователей ЕАСУЗ на перестройку структуры КОЗ	Обработка запросов пользователей ЕАСУЗ на перестройку КОЗ	\N	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
2beb698f-f688-4d88-a342-cf44d0197877	d0d3c706-c94c-49f5-8d6b-ecfabd63f364	Детальное описания и визуальное отображения всех процессов, с использованием специализированных инструментальных средств моделирования.	Высокий уровень детализации и визуальной выразительности моделей	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
a1224f97-4dbd-4a1b-937d-fc3e1d2008e2	27d64c6e-2862-4ec5-b06c-8b05f0fdb60d	Своевременная и надлежащая подготовка кадровых документов (приказы: прием, увольнение, отпуска, переводы и т.д.) | Своевременная подготовка табелей учета рабочего времени	Своевременная и надлежащая подготовка кадровых документов (приказы: прием, увольнение, отпуска, переводы и т.д.) | Соблюдение установленных сроков подготовки табеля учета рабочего времени. Ежемесячно не позднее 15-го (при совпадении отчетного дня с выходным табель предоставляется в 1-ый рабочий день) и не позднее 1-го числа следующего за отчетным месяцем	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
4559daa3-47f8-45da-abbd-85e301ebc204	27d64c6e-2862-4ec5-b06c-8b05f0fdb60d	Своевременная подготовка табелей учёта рабочего времени	Своевременная подготовка табелей учёта рабочего времени	\N	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
bebef9a2-9604-4011-bd02-d1006b7dc8f2	27d64c6e-2862-4ec5-b06c-8b05f0fdb60d	Отсутствие нарушений по своевременному и качественному направлению кадровой отчетности	Соблюдение сроков направления кадровой отчетности в соответствующие органы	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
d719bd16-3a3a-4928-8ee0-7aecaba6114e	6b629f4d-231a-497c-beb1-e997293af4a9	Развитие ЕАСУЗ в соответствии \nс предложениями Комитета по конкурентной политике Московской области, пользователей \nи непосредственно необходимостью, в том числе, при изменении законодательства	Реализация акцептованных предложений по улучшению системы	количество поступивших акцептованных предложений * 100%	[{"score": 100.0, "conditions": [">= 85%"]}, {"score": 0.0, "conditions": ["< 85%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
d2fbf8ab-c751-45a9-bb06-2cb23879cd51	6b629f4d-231a-497c-beb1-e997293af4a9	Обеспечение своевременного предоставления \n(в рамках развития ЕАСУЗ) описаний задач \nпо улучшению, доработке системы	Предоставление разработчику ТЗ по улучшению	доработке в установленный срок (не менее 1)	[{"score": 100.0, "conditions": [">= 1"]}, {"score": 0.0, "conditions": ["0"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
c9313072-c9ef-4e45-b36d-fbd2b7e58daf	6d6660e4-7c55-45d7-a8bd-aad933855458	Оперативное руководство отдельными проектами	Управление проектными командами, соблюдение выполнения дорожной карты (плана мероприятий) реализации проектов	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
57b7b78c-9afd-4fb1-b30b-f65f49030044	6d6660e4-7c55-45d7-a8bd-aad933855458	Улучшение стандартов подготовки проектной документации	Наличие актуальных версий внутренних документов и стандартов по ведению документации, доработка документации согласно установленным требованиям	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
c0000a7f-e7fb-4747-8ce9-ee1fec830806	6d6660e4-7c55-45d7-a8bd-aad933855458	Выполнение задач по координации проектов	Успешно завершенные этапы проектов, курируемых Консультантом | Точность планирования и выполнение работ в установленные сроки	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
bff82bee-82f9-4fd7-9ecf-c7ae0053df42	6d6660e4-7c55-45d7-a8bd-aad933855458	Предоставление аналитической информации о текущем положении дел в проектах, необходимой для принятия управленческих решений	Объективность предоставленных данных и правильность выводов, сделанных на основе аналитики	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
41c651a8-58d3-4e75-ac6a-7fd7cb9d1b5b	6d6660e4-7c55-45d7-a8bd-aad933855458	Обеспечение контроля соблюдения сроков выполнения проектной деятельности в отделе	Контроль своевременного осуществления проектной деятельности.	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
0b53eead-f713-4206-8db1-b5a4bd91e99e	448164ba-bf28-4abd-a60a-b26f37f734e7	Обеспечение деятельности по автоматизации процессов связанных с формированием данных	Автоматизация бизнес-процессов, связанных со сбором, формированием и обобщением данных	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
fba78c98-031d-41b7-8ee9-15bc242bd011	d54161aa-f111-4109-9d7f-96f47d2f5e82	Обеспечение деятельности по мониторингу и контролю закупок в Московской области в рамках Федерального закона «О контрактной системе в сфере закупок товаров, работ, услуг для обеспечения государственных и муниципальных нужд» от 05.04.2013 № 44-ФЗ	Своевременная публикация и контрактация закупок по социально значимым направлениям	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
a2c9ff2e-3f2d-49df-b4dc-48767023f168	3e332410-3e15-4a8c-b3bd-74351e94ddd5	Контроль выполнения доработок аналитических панелей (дашбордов) на Аналитическом портале Государственной информационной системы Московской области «Единая автоматизированная система управления закупками»	Обеспечение своевременных, разработок и доработок дашбордов в части компетенции Управления	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
647414bb-d823-4bc3-b591-69fa7c404b4a	3e332410-3e15-4a8c-b3bd-74351e94ddd5	Подготовка аналитических материалов, справок и докладов по вопросам, относящимся к компетенции отдела | Контроль за обеспечением корректного и своевременного обновления данных на Аналитическом портале ЕАСУЗ	Своевременное и надлежащее формирование данных и аналитических материалов в части компетенции Управления | Обеспечение своевременных и актуальных данных на Аналитическом портале ЕАСУЗ	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
62afba5d-9f4f-442b-870a-06d0feae2740	3e332410-3e15-4a8c-b3bd-74351e94ddd5	Подготовка предложений, разработка и доработка аналитических панелей (дашбордов) на Аналитическом портале Государственной информационной системы Московской области «Единая автоматизированная система управления закупками» (ЕАСУЗ)	Своевременное и надлежащее формирование предложений, разработки и доработок дашбордов в части компетенции Управления	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
f1dc4992-5ac1-436b-a785-673592947041	3e332410-3e15-4a8c-b3bd-74351e94ddd5	Контроль за обеспечением корректного и своевременного обновления данных на Аналитическом портале ЕАСУЗ	Контроль корректного и своевременного обновления данных на Аналитическом портале ЕАСУЗ	\N	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
9ef6c0d4-6e50-4a70-b00f-8f2ca0ede79f	3e332410-3e15-4a8c-b3bd-74351e94ddd5	Формирование по результатам мониторинга закупок аналитических отчетов по различным вопросам закупочной деятельности в Московской области | Обеспечение деятельности по мониторингу в Московской области в рамках Федерального закона «О контрактной системе в сфере закупок товаров, работ, услуг для обеспечения государственных и муниципальных нужд» от 05.04.2013 № 44-ФЗ	Своевременная подготовка аналитических материалов, справок и докладов по вопросам, относящимся к компетенции отдела | Обеспечение организации своевременного мониторинга и выявления нарушений в размещенных закупках в рамках №44-ФЗ. Не допущение нарушений размещенных закупок в размере не более 5% от общего числа опубликованных конкурентных закупках рамках 44-ФЗ	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
ecb86a3d-1574-463f-bd6a-919c27690afa	3e332410-3e15-4a8c-b3bd-74351e94ddd5	Контроль за обеспечением корректного и своевременного предоставления выгрузок, аналитических отчетов	Отсутствие нарушений в своевременности и актуальности предоставляемых данных	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
7cb9e6d1-e300-46a3-8321-5337371f80c3	3e332410-3e15-4a8c-b3bd-74351e94ddd5	Обеспечение деятельности по мониторингу в МО в рамках Федерального закона от 05.04.2013 № 44-ФЗ «О контрактной системе в сфере закупок товаров, работ, услуг для обеспечения государственных и муниципальных нужд»	Мониторинг закупок в МО в рамках 44-ФЗ	\N	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
16dd2d36-9fa7-41f3-861d-9f7adefad2f3	3e332410-3e15-4a8c-b3bd-74351e94ddd5	Подготовка аналитических материалов, справок и докладов по вопросам, относящимся к компетенции отдела | Обеспечение своевременных и актуальных данных на Аналитическом портале ЕАСУЗ	Своевременное и надлежащее формирование данных и аналитических материалов в части компетенции отдела | Не допущение неактуальных данных на Аналитическом портале ЕАСУЗ	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
ebdf5532-0021-40c2-a651-62f3abc87aa0	3e332410-3e15-4a8c-b3bd-74351e94ddd5	Обеспечение развития и работоспособности Аналитического портала ЕАСУЗ	Отсутствие нарушения сроков доработок дашбордов на Аналитическом портале ЕАСУЗ Обеспечение ежедневной работоспособности дашбордов на Аналитическом портале ЕАСУЗ	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
519241d7-f6c9-4c84-b89c-25e4e05a64ea	3e332410-3e15-4a8c-b3bd-74351e94ddd5	Обеспечение своевременных и актуальных данных на Аналитическом портале ЕАСУЗ	Своевременность и актуальность данных на Аналитическом портале ЕАСУЗ	\N	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
cce1e99f-d008-43dd-8f6c-386601b9b545	d1a3708c-b0d1-4907-be6e-166c17d21f8d	Своевременная и надлежащим образом зарегистрированная корреспонденция в Межведомственной системе электронного документооборота Московской области, \nв т.ч. ЗК (входящая, исходящая, организационно-распорядительная), поступающая в Комитет по конкурентной политике Московской области, в том числе на бумажных носителях, в том числе отсутствие ошибок при регистрации и подготовке проектов резолюций, и доведение ее по назначению до исполнителей, рассылка корреспонденции по назначению | Обеспечение взаимодействия с МТСО suppоrt.mosreg.ru: своевременное направление заявок на обеспечение материально-технических потребностей Комитета по конкурентной политике Московской области (оснащение мебелью, ремонт, тех. обслуживание и т.д.); направление заявок на транспортное обслуживание в целях обеспечения участия работников в выездных мероприятиях	Кол-во своевременной регистрации документов	кол-во поступившей на регистрацию документов*100% (регистрация в день поступления документа). Соблюдение надлежащего заполнения карточек документов | Своевременное направление заявок на обеспечение материально-технических потребностей Комитета по конкурентной политике Московской области и на транспортное обслуживание в целях обеспечения участия работников в выездных мероприятиях	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["< 100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
88c790b1-64a3-4c5b-bb03-646e7fd0e047	41a96d1c-812e-4022-9ccc-2f2c6197eff4	Обеспечение взаимодействия с МТСО support.mosreg.ru: своевременное направление заявок на МТО Комитета (мебель, ремонт, тех. обслуживание), направление заявок на транспортное обслуживание	Взаимодействие с МТСО: заявки на МТО и транспортное обслуживание Комитета	\N	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
a4d40a02-5290-4c1b-ae8d-0f2f5aee5a66	d1a3708c-b0d1-4907-be6e-166c17d21f8d	Консультирование и оказание методической помощи сотрудникам Комитета по конкурентной политике Московской области по работе с документами	Кол-во оказанных консультаций	количество обращений за консультацией*100%	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["< 100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
cfb6cd47-12b4-4659-ae45-1d6d9d1e8109	3e332410-3e15-4a8c-b3bd-74351e94ddd5	Обеспечение контроля соблюдения сроков выполнения проектной деятельности в отделе	Контроль и своевременное уведомление о просрочках в проектной деятельности в отделе.	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
d9d70610-54c6-4774-89e7-964f1fa7e1e2	3e332410-3e15-4a8c-b3bd-74351e94ddd5	Описание и визуализация процессов отдела	Цифровизация процессов, выполняемых в отделе	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
d4d1b44c-3801-4ad6-951a-10c9328d60f0	3e332410-3e15-4a8c-b3bd-74351e94ddd5	Ведение и актуализация единой базы стандартов в отделе	Своевременное и надлежащее ведение единой базы данных стандартов	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
f755c19a-7096-41df-bd60-2916ba1d193d	28c849e4-11de-428e-b52e-76e971eb0f9a	Мониторинг исполнения мероприятий и достижения показателей Нацплана	-регулярный сбор данных о ходе выполнения мероприятий, достижении показателей; -проверка собранной информации на предмет ошибок	искажений; -оценка отклонений от запланированного значения; -анализ динамики показателей; - регулярное обсуждение результатов с ответственными ЦИО и ОМСУ; -идентификация проблем и рисков   1 квартал – до 10.04.2026 2 квартал – до 10.07.2026 3 квартал – до 09.10.2026 4 квартал – подготовка доклада об итогах исполнения Нацплана	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
7b7b7626-40c2-4883-a944-929eb1fa32bc	ffe35e0a-5b4e-4d34-a909-db60ef5807b0	Достижение целевых показателей развития конкуренции в регионе и реализация мероприятий по развитию конкуренции	-регулярный сбор данных о ходе выполнения мероприятий, достижении показателей; -проверка собранной информации на предмет ошибок	искажений; -оценка отклонений от запланированного значения; -анализ динамики показателей; -идентификация причин отклонений: поиск факторов, которые привели к расхождениям между планом и фактом; -подготовка отчета; -регулярное обсуждение результатов с ответственными ЦИО и ОМСУ; -идентификация проблем и рисков; -разработка и внедрение корректирующих мер: принятие решений о необходимых изменениях в плане мероприятий, распределении ресурсов, методах работы для устранения отклонений и минимизации рисков; -оценка эффективности мер  1 квартал – 20% 2 квартал – 40% 3 квартал – 60% 4 квартал – 100%	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
de658007-7683-4a51-b215-305137324975	942809aa-3658-44af-b40a-9a51aa016a19	Методическое сопровождение деятельности ЦИО по развитию конкуренции в Московской области	- участие в совещаниях; - взаимодействие с исполнителями в ЦИО и ОМСУ на каждом из рынков по вопросам развития конкуренции ДК	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
9e1d09ad-4c82-4e35-8b99-596f9394fcd4	3839026a-a2a0-4d02-8f14-f3ca188cd397	Участие в подготовке предложений по улучшению деятельности органов исполнительной власти и местного самоуправления Московской области в сфере содействия развитию конкуренции в Московской области	- проведение анализа ситуации на рынке; - подготовка аналитических материалов	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
000ce80a-2938-4644-aeb9-f83afd465380	b4deb77d-6298-453e-94ee-eb5689129a4d	Рассмотрение инвестиционных проектов\n (в т.ч. ГЧП)	Отсутствие нарушений законодательства РФ в заключениях по проектам	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
ef0c48e6-1a0d-41e0-a6ea-eb640e42202d	b4deb77d-6298-453e-94ee-eb5689129a4d	Обеспечение цифровизации данных по инвестиционным договорам \n(в том числе проектам ГЧП) | Обеспечение функционирования цифровых платформ в сфере инвестиций	Своевременная консолидация, актуализация и визуализация данных | Контроль работоспособности платформ и осуществление доработок	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
203c85c1-49bc-4be9-8aa6-768bbd5f0993	b4deb77d-6298-453e-94ee-eb5689129a4d	Обеспечение функционирования цифровых платформ в сфере инвестиций	Функционирование цифровых платформ в сфере инвестиций	\N	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
c29f3ac2-f872-429d-8770-29b964702983	b4deb77d-6298-453e-94ee-eb5689129a4d	Рассмотрение инвестиционных проектов	Отсутствие нарушений законодательства РФ в заключениях по проектам	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
5023a379-7b21-4798-a205-8698987ba077	b4deb77d-6298-453e-94ee-eb5689129a4d	Подготовка аналитических материалов	Формирование и представление отчетов, ведение реестров  (месяц, квартал, год) | Своевременное выявление нарушений по публикации торгов.	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
a91be2d9-fcb9-45fe-a9cb-4a4c83d99f3b	b4deb77d-6298-453e-94ee-eb5689129a4d	Мониторинг проведения торгов на право заключения инвестиционных договоров	Мониторинг торгов на право заключения инвестиционных договоров	\N	[{"score": 100.0, "conditions": ["100%"]}, {"score": 0.0, "conditions": ["<100%"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
490418f8-3a82-4685-bd0e-1e1982b605b9	28c849e4-11de-428e-b52e-76e971eb0f9a	Достижение показателей и задач Национального плана развития конкуренции в муниципальных образованиях Московской области	-регулярный сбор данных о ходе выполнения мероприятий, достижении показателей ОМСУ -проверка собранной информации на предмет ошибок	искажений; -оценка отклонений от запланированного значения; -анализ динамики показателей; - регулярное обсуждение результатов с ответственными ОМСУ; -идентификация проблем и рисков  1 квартал – до 10.04.2026 2 квартал – до 10.07.2026 3 квартал – до 09.10.2026 4 квартал – подготовка доклада об итогах исполнения Нацплана	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
fb5efa2c-a18b-43a6-a6ef-715dc80657de	4c262ac4-e331-48ba-a780-7992255ba83e	Достижение целевых показателей развития конкуренции в муниципальных образованиях Московской области. Результативность проведенных мероприятий по развитию конкуренции	- регулярный сбор данных о ходе выполнения мероприятий, достижении показателей, в части ОМСУ; -проверка собранной информации на предмет ошибок	искажений; -оценка отклонений от запланированного значения; -анализ динамики показателей; -идентификация причин отклонений: поиск факторов, которые привели к расхождениям между планом и фактом; -регулярное обсуждение результатов с ответственными ОМСУ  1 квартал – 20% 2 квартал – 40% 3 квартал – 60% 4 квартал – 100%	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
1e49bc01-17f2-49e4-9275-f98a625a703e	b94f3e05-f2be-405d-b1d6-1b0c1c1a92c0	Методическое сопровождение деятельности ОМСУ Московской области по развитию конкуренции	- участие в совещаниях; - взаимодействие с исполнителями в ОМСУ на каждом из рынков по вопросам развития конкуренции ДК	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
cbc4c7a2-0393-4cd4-bfd6-27542c8c79c8	3839026a-a2a0-4d02-8f14-f3ca188cd397	Участие в подготовке предложений по улучшению деятельности органов местного самоуправления Московской области в сфере содействия развитию конкуренции в Московской области	- проведение анализа ситуации на рынке; - подготовка аналитических материалов	\N	[{"score": 100.0, "conditions": ["Соблюдается"]}, {"score": 0.0, "conditions": ["Не соблюдается"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
6dc5a613-ad2d-4d98-b69a-ef23d00f3deb	11a15b72-61e2-44a0-8246-dbc830a0d791	тест	\N	\N	null	null	null	f	\N	\N	\N	2026-05-03 06:46:13.06859+00	\N	0	\N	f	\N
0e2e5541-d571-41a8-a853-7e1f7efd0250	ce9ab641-ba33-458f-a85b-ed3d682ea3bf	Участие в проектных совещаниях и подготовка проектной документации	\N	\N	null	null	null	f	\N	\N	\N	2026-05-03 07:58:16.043712+00	\N	0	\N	f	\N
64fcfce8-999f-4006-8c8f-59c3703d7c7d	4fff8981-9470-4403-ab0f-3416961b3fcc	Своевременное предоставление отчётности в установленные сроки	\N	\N	null	null	null	f	\N	\N	\N	2026-05-03 08:01:03.664518+00	\N	0	\N	f	\N
d0b9888d-bf26-4c9b-bb81-58da6123a5ed	77a555d2-3cd1-413a-9e36-01bd9e8a0592	Все условия должны быть соблюдены	\N	\N	null	[{"order": 0, "sub_type": "sub_binary", "description": "Для каждого проекта разработан детальный план реализации"}, {"order": 1, "sub_type": "sub_binary", "description": "Осуществляется контроль выполнения плана"}, {"order": 2, "sub_type": "sub_binary", "description": "Регулярно предоставляется отчёт руководству"}]	null	f	\N	\N	\N	2026-05-03 08:06:19.319399+00	\N	0	\N	f	\N
ce47d5d9-a3da-47a9-aae2-586923bcedde	66b0e9cd-9ca3-46bc-afb6-c09ae3ecb043	Объём закупок конкурентными способами / общая сумма закупок × 100%	Сумма закупок конкурентным способом (руб.)	Общая сумма закупок заказчика (руб.)	[{"score": 100, "condition": ">=67"}, {"score": 0, "condition": "<67"}]	null	null	t	\N	\N	\N	2026-05-03 08:19:45.558322+00	\N	0	\N	f	\N
ea89b0ae-5841-48e6-8536-d9c5acdde0ba	90041b06-b5fc-4720-a618-deee79efa5e2	Все подпоказатели должны быть выполнены	\N	\N	null	[{"name": "Конкуренция (количество участников)", "cumulative": false, "thresholds": [{"score": 100, "condition": ">=2,7"}, {"score": 0, "condition": "<2,7"}], "numerator_label": "Количество участников конкурентных процедур", "denominator_label": "Количество конкурентных процедур"}, {"name": "Доля жалоб", "cumulative": false, "thresholds": [{"score": 100, "condition": "<1"}, {"score": 0, "condition": ">=1"}], "numerator_label": "Количество обоснованных жалоб", "denominator_label": "Количество опубликованных процедур"}]	null	f	\N	\N	\N	2026-05-03 08:35:21.746282+00	\N	0	\N	f	\N
39956a99-28fe-4da6-afc7-80e46889006d	e7992c49-d33d-4132-ab4a-6c86c6ac2727	Объём закупок конкурентными способами / общая сумма закупок × 100%	Сумма закупок конкурентным способом (руб.)	Общая сумма закупок заказчика (руб.)	[{"score": 100, "condition": ">=67"}, {"score": 0, "condition": "<67"}]	null	null	f	\N	\N	\N	2026-05-03 08:48:03.139878+00	\N	0	\N	f	\N
29c08a99-3da9-4f66-acdd-e27970febb9c	2f3e2ac3-0f38-42ec-91f4-e9a04da2937e	Объём закупок у СМП нарастающим итогом	Сумма контрактов с СМП (руб.)	СГОЗ, утверждённый на год (руб.)	null	null	{"Q1": [{"score": 100, "condition": ">=15"}, {"score": 0, "condition": "<15"}], "Q2": [{"score": 100, "condition": ">=15"}, {"score": 0, "condition": "<15"}], "Q3": [{"score": 100, "condition": ">=15"}, {"score": 0, "condition": "<15"}], "Q4": [{"score": 100, "condition": ">=15"}, {"score": 0, "condition": "<15"}]}	t	\N	\N	\N	2026-05-03 08:58:15.743919+00	\N	0	\N	f	\N
55dc96b1-9585-44d1-94a9-f0eeaec7841d	6d61d322-0c8a-4eca-b547-a082ff46fb01	Обеспечение конкуренции при осуществлении закупок в Московской области (общее значение показателя по МО: кол-во участников закупки):\n в 1 кв. (за месяцы) 2,7; 2 кв. (за месяцы) 3,0; 3 кв. (за месяцы) 3,3; 4 кв. (за месяцы/за год) 3,6)	Обеспечение среднего количества участников конкурентных процедур от общего числа конкурентных процедур	\N	[{"score": 100.0, "conditions": ["1 кв.- >=2", "7 2 кв.- >=3", "0 3 кв.- >=3", "3 4 кв.(год)- >=3", "6"]}, {"score": 0.0, "conditions": ["1 кв.- <2", "7 2 кв.- <3", "0 3 кв.- <3", "3 4 кв.(год)- <3", "6"]}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	t	\N
935971a5-fca6-4be4-90d3-3c7453a81a37	d88b4df7-8f9d-4d1f-a0b9-9cdcdc4547c4	Обеспечение качественного согласования проектов ЛНА и (или) НПА за отчетный период	Отсутствие более 2-х повторных согласований проектов ЛНА и (или) НПА	\N	[{"score": 100, "condition": "<=3"}, {"score": 0, "condition": ">3"}]	null	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	Колличество повторных согласований подготовленных проектов ЛНА и (или) НПА	f	Отсутствие более 3-х повторных согласований подготовленных проектов ЛНА и (или) НПА
1d4a187b-fcad-4e59-8b98-b06998c85079	55145a3b-8bc7-45f4-a9ba-528bb25a21d3	Объем закупок, осуществляемых заказчиками Московской области, конкурентными способами (нарастающим итогом)	Сумма закупок, осуществленных конкурентным способом заказчиками Московской области	Общая сумма закупок заказчиков Московской области	[{"score": 100, "condition": ">=67"}, {"score": 50, "condition": ">50"}, {"score": 0, "condition": "<=50"}]	null	null	t	67%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	Сумма закупок, осуществленных конкурентным способом заказчиками Московской области/общая сумма закупок заказчиков Московской области*100%
ce40264e-3875-408a-88d3-3e73c38c6cde	67eebcb0-6142-41c9-8258-a1224cb5b912	Соблюдение исполнительской дисциплины при работе в межведомственной системе электронного документооборота Московской области (МСЭД, ЗК МСЭД), сроков исполнения протокольных поручений, образующихся в ходе деятельности Учреждения, сроков исполнения приказов и распоряжений Учреждения, письменных и устных поручений руководства	Учитывается соблюдение всех сроков. Учитываются в том числе сроки, перенесенные по согласованию с руководством (за исключением сроков, установленных законодательством Российской Федерации и приказами Учреждения)	\N	[{"score": 100.0, "conditions": ["Соблюдаются все сроки в полном объеме"]}, {"score": 0.0, "conditions": ["Сроки не соблюдаются"]}]	null	null	f	100%	Исполнительская дисциплина соблюдается в полном объёме. Сроки исполнения протокольных поручений, образующихся в ходе деятельности Учреждения, а также сроки исполнения приказов и распоряжений Учреждения, письменных и устных поручений руководства не нарушаются.	Исполнительская дисциплина не соблюдается в полном объёме. Допущены нарушения сроков исполнения протокольных поручений, приказов и распоряжений Учреждения.	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
f671c156-f32d-4b9e-b884-e3971382f491	30903993-c161-4568-a665-6914666a9ba5	1. Отсутствие привлечения Учреждения к административной ответственности\n2. Отсутствие удовлетворенных исковых требований, предусматривающих взыскание денежных средств с Учреждения	1. Отсутствие фактов привлечения Учреждения к адм. отв. в отчетный период 2. Отсутствие фактов удовлетворенных имущественных требований в отчетный период	\N	[{"score": 100.0, "conditions": ["Отсутствие"]}, {"score": 0.0, "conditions": ["Наличие"]}]	[{"order": 0, "sub_type": "sub_binary", "description": "Отсутствие привлечения Учреждения к административной ответственности", "sub_criterion": "Отсутствие фактов привлечения Учреждения к административной ответственности в отчетный период"}, {"order": 1, "sub_type": "sub_binary", "description": "Отсутствие удовлетворенных исковых требований, предусматривающих взыскание денежных средств с Учреждения", "sub_criterion": "Отсутствие фактов удовлетворенных имущественных требований в отчетный период"}]	null	f	100%	\N	\N	2026-05-02 06:57:30.890995+00	\N	0	\N	f	\N
\.


--
-- Data for Name: kpi_indicators; Type: TABLE DATA; Schema: public; Owner: kpi_user
--

COPY public.kpi_indicators (id, code, name, formula_type, is_common, is_editable_per_role, status, version, valid_from, valid_to, created_by, created_at, updated_at, indicator_group, unit_name, default_weight) FROM stdin;
7a8940f7-f65e-4b73-a26b-0fd271f99378	\N	Обеспечение своевременного рассмотрения обращений граждан в соответствии c Федеральным законом от 02.05.2006 № 59-ФЗ «О порядке рассмотрения обращений граждан Российской Федерации»	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Правовое обеспечение	\N	\N
f2da6154-33a8-4f50-8317-7baa96e01502	\N	Обеспечение качественной подготовки земельных участков на торги	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Закупочная деятельность	\N	\N
02ff8f25-e182-430c-b4c3-22e02f990506	\N	Развитие конкурентной среды в земельно-имущественных торгах в Московской области	multi_threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Закупочная деятельность	\N	\N
9b54640c-a571-4fb9-bcb3-3768ed4d5c5b	\N	Обеспечение развития ЕАСУЗ	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Информационные технологии	\N	\N
6ea4c1fe-0408-47a5-b38d-0bddb9f1879c	\N	Обеспечение деятельности по информационной безопасности	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Информационные технологии	\N	\N
8496f8d1-fb40-44c4-8046-ea6070a8a6d8	\N	Обеспечение информационно-технической и технологической деятельности	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Информационные технологии	\N	\N
6d6660e4-7c55-45d7-a8bd-aad933855458	\N	Обеспечение проектной деятельности	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Проектная деятельность	\N	\N
53099852-be21-4b46-b7b1-f33efa9e7445	\N	Обеспечение бизнес-анализа	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Аналитическая деятельность	\N	\N
3e332410-3e15-4a8c-b3bd-74351e94ddd5	\N	Обеспечение аналитической деятельности	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Аналитическая деятельность	\N	\N
fc71cac0-b6ed-416d-a9af-e0fc192f36a4	\N	Своевременная организация в установленном порядке закупок и приобретение товаров, работ, услуг в целях обеспечения деятельности Учреждения, исполнение Плана-графика закупок без нарушения утвержденных сроков и контроль за проведением закупочной деятельности для нужд Учреждения	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Закупочная деятельность	\N	\N
159bd802-31a1-484f-ba1d-cff5da969ae1	\N	Обеспечение надлежащего и своевременного ведения документооборота в Учреждении и архива с выделением дел, не имеющих исторической ценности, подлежащих утилизации	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Документооборот	\N	\N
ed8c11a7-cd21-484c-be06-b2ddd19ebe6a	\N	Обеспечение качественного исполнения контрольных поручений в установленные сроки	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Прочие показатели	\N	\N
21fe0a29-3f97-426a-8be4-5f230a3299bf	\N	Обеспечение надлежащей деятельности в области трудового законодательства	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Правовое обеспечение	\N	\N
b92ac9eb-3d24-4044-9834-653aaa66524a	\N	Обеспечение своевременного рассмотрения обращений граждан в соответствии Федерального закона от 02.05.2006 № 59-ФЗ «О порядке рассмотрения обращений граждан Российской Федерации»	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Правовое обеспечение	\N	\N
72bd3fe5-1423-421f-882c-4babc483b94a	\N	Обеспечение своевременного и достоверного планирования расходов бюджета Московской области на обеспечение деятельности Учреждения	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Организационное обеспечение	\N	\N
11d82078-6cb5-428d-af50-cff69855f84e	\N	Обеспечение своевременного и правильного проведения инвентаризации	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Прочие показатели	\N	\N
72219071-2fbf-4bd8-8d92-61bc2eca3309	\N	Исполнение обязательств по контрактам в части оплаты, недопущение нецелевого использования бюджетных средств	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Закупочная деятельность	\N	\N
90105cbc-ea6b-498a-bb5a-b0198817d796	\N	Обеспечение технической поддержки пользователей ЕАСУЗ	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Информационные технологии	\N	\N
30903993-c161-4568-a665-6914666a9ba5	\N	Обеспечение правового сопровождения деятельности Учреждения	multi_binary	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-04 15:42:26.585662+00	Правовое обеспечение	\N	\N
788f3eda-6413-46e4-8f26-13a248bc6ad3	\N	Соблюдение Правил внутреннего трудового распорядка, Кодекса этики	binary_manual	t	f	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Общие показатели	\N	10
98f1a694-2b7c-4ac7-9bc6-922d91216812	\N	Формирование и исполнение плана-графика закупок, внесение изменений в план-график закупок	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Закупочная деятельность	\N	\N
a62f3183-a15f-4c51-bda8-9f9cf10ee2aa	\N	Обеспечение исполнения обязательств по государственным контрактам	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Закупочная деятельность	\N	\N
602ce79b-f524-4656-81bf-5ba71bebfdce	\N	Обеспечение выполнения основных функциональных показателей при ведении закупочной деятельности в Учреждения	quarterly_threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Закупочная деятельность	\N	\N
00b0c8fc-29a8-4783-8eb8-628adabce00f	\N	Обеспечение оформления и передачи первичной информации в ГКУ МО ЦБ МО своевременных расчетов с работниками по оплате труда, начисление и перечисление налогов и взносов \nна выплаты работникам	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Прочие показатели	\N	\N
9ce10475-3a61-443b-a3e0-bb3f408fea29	\N	Обеспечение контроля своевременного формирования и направления информации и отчетности в ИФНС, Росстат и др. фонды	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Аналитическая деятельность	\N	\N
cfbd58ae-8d53-4c14-8388-3328222ab69e	\N	Обеспечение исполнения иных финансовых операций с денежными средствами (документами)	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Документооборот	\N	\N
54ab991b-8cf2-44de-8f05-2c2a18b92a4c	\N	Обеспечение контрольных мероприятий, своевременного и достоверного отражения информации в отношении финансовых активов	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Организационное обеспечение	\N	\N
41e00483-fde9-4f6e-88be-3b06b9a0eaba	\N	Обеспечение контрольных мероприятий по соблюдению \nнормативных затрат	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Правовое обеспечение	\N	\N
fb740b15-7fce-441b-97f3-08d1ef494390	\N	Обеспечение своевременного и правильного отражения хозяйственных операций нефинансовых активов	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Организационное обеспечение	\N	\N
8167f3ce-9eec-46fb-8214-d7b5b6b04b48	\N	Обеспечение надлежащей деятельности \nв области кадрового делопроизводства	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Прочие показатели	\N	\N
19a71e9c-5d5d-4336-87ba-9473103e5ff5	\N	Отсутствие предписаний органов, осуществляющих надзорную деятельность в области трудового законодательства \nи охраны труда	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Правовое обеспечение	\N	\N
349cff7c-981a-45ec-bd64-cadf37f0c221	\N	Обеспечение ведения воинского учета	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Прочие показатели	\N	\N
84ea8532-c84b-46d0-b6f5-d0598cbcdb39	\N	Обеспечение надлежащей деятельности в области кадрового делопроизводства и охраны труда	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Прочие показатели	\N	\N
e8bd6c80-3405-4639-99e3-6cf7039cfa3d	\N	Эффективная организация делопроизводства в Учреждении	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Прочие показатели	\N	\N
abd8f253-6109-43f3-9b7f-f2154c99edf7	\N	Актуализация информации на официальном Интернет-ресурсе Учреждения	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Прочие показатели	\N	\N
5aa47867-1959-4521-ae5e-a56e4a3e9e03	\N	Обеспечение подбора персонала	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Прочие показатели	\N	\N
0acf0bcf-7297-42fd-931d-3470eb11fe85	\N	Обеспечение подготовки кадровых документов в установленные законодательством сроки	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Правовое обеспечение	\N	\N
52a82268-e352-4953-965f-b282350cc65d	\N	Мониторинг нарушений размещения закупок государственными заказчиками в рамках Федерального закона «О контрактной системе в сфере закупок товаров, работ, услуг для обеспечения государственных и муниципальных нужд» от 05.04.2013 № 44-ФЗ (44-ФЗ)	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Аналитическая деятельность	\N	\N
cd5f98b5-a9f8-4720-a731-901039db3787	\N	Проведение мониторинга закупок посредством сбора, обобщения, систематизации и оценки информации в рамках 44-ФЗ	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Аналитическая деятельность	\N	\N
3d5ddd26-a2d8-45e7-9d26-4436be18cdbd	\N	Формирование по результатам мониторинга закупок аналитических отчетов по различным вопросам закупочной деятельности в Московской области, входящим в компетенцию Комитета по конкурентной политике Московской области	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Аналитическая деятельность	\N	\N
d1a3708c-b0d1-4907-be6e-166c17d21f8d	\N	Организация делопроизводства в Комитете по конкурентной политике Московской области	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Информационные технологии	\N	\N
41a96d1c-812e-4022-9ccc-2f2c6197eff4	\N	Организация делопроизводства в Комитете по конкурентной политике МО	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Информационные технологии	\N	\N
82fbb17a-be9d-441d-8dde-1da428e4a69e	\N	Обеспечение развития подсистемы ЕАСУЗ	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Информационные технологии	\N	\N
d9aa6ebe-6215-4ada-b35e-302f4932707e	\N	Отсутствие нарушения сроков реализации проектов	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Проектная деятельность	\N	\N
867a139f-1901-4f5e-a8f3-f4dfb2fb00d1	\N	Обеспечение интеграционного взаимодействия ЕАСУЗ	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Информационные технологии	\N	\N
bba045b2-258f-480c-95bc-0831c0cec21e	\N	Обеспечение методологической поддержки ЕАСУЗ	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Информационные технологии	\N	\N
14114eba-5b29-4db9-88ce-4f99ced6fb34	\N	Обеспечение технической/методологической\nподдержки пользователей ЕАСУЗ	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Информационные технологии	\N	\N
d1e6f2f6-7b2a-4d58-9894-be723bc0afe2	\N	Информационно-техническое обеспечение деятельности	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Информационные технологии	\N	\N
f173f4b9-abc5-412c-9f73-17f24335ccd2	\N	Соблюдение, установленных законодательством Российской Федерации сроков на подготовку ответов	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Правовое обеспечение	\N	\N
ba6bba4c-c116-4289-8ec5-2cd12b148878	\N	Недопущение взыскания денежных средств	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Прочие показатели	\N	\N
3fd7828f-995e-4894-bfb8-4ee8462af6bc	\N	Обеспечение соблюдения законности \nв деятельности Учреждения	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Правовое обеспечение	\N	\N
558d50d0-ee17-48da-826f-b3e76faed255	\N	Отсутствие фактов наложения административных штрафов при представлении интересов Учреждения в административных и контрольно-надзорных органах	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Прочие показатели	\N	\N
73e28219-ac45-471d-96c2-da47a8cf298c	\N	Оказание правовой помощи по запросам структурных подразделений Учреждения	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Правовое обеспечение	\N	\N
5e1c2ce2-a597-4bad-a22c-0e224d0e1135	\N	Аналитика судебных дел	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Информационные технологии	\N	\N
0eb1454a-191c-4288-b37e-d19a0de4657d	\N	Представление интересов Комитета по конкурентной политике Московской области и Учреждения в судебных заседаниях и административных органах при осуществлении земельно-имущественных торгов	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Закупочная деятельность	\N	\N
9c917107-ad5a-4272-bd99-4480fbef796c	\N	Подготовка обзоров законодательства РФ и МО в части компетенции Учреждения (ЗИТ                                           и № 223-ФЗ)	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Правовое обеспечение	\N	\N
db791a71-da9b-4fc6-8dbe-903d43434a65	\N	Эффективная работа в межведомственной системе электронного документооборота Московской области (МСЭД)	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Документооборот	\N	\N
a71fe6f2-273b-4359-a772-449bbf7efe6b	\N	Организация взаимодействия с органами власти, органами местного самоуправления и другими организациями	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Прочие показатели	\N	\N
2d66d372-0eff-48e9-b2d3-7fb06e8d2318	\N	Правовое сопровождение деятельности Учреждения в области ГО и ликвидации ЧС	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Правовое обеспечение	\N	\N
a0bf5434-e043-457a-947b-243dfa09e887	\N	Правовое сопровождение деятельности Учреждения	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Правовое обеспечение	\N	\N
44268082-05f5-49f9-9af3-61b8d059ce12	\N	Мониторинг законодательства Российской Федерации и Московской области	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Аналитическая деятельность	\N	\N
b0a22927-954b-48eb-8128-bb0361e28746	\N	Обеспечение заказчиками МО снижения рисков срыва закупочных процедур в соответствии с Федеральным законом № 223-ФЗ	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Закупочная деятельность	\N	\N
499b8c99-019e-4198-b4fe-fdfd69890634	\N	Эффективная организация делопроизводства \nв Комитете по конкурентной политике Московской области	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Информационные технологии	\N	\N
c9929604-138b-4998-a7db-d644b21e0991	\N	Эффективная организация делопроизводства \nв Комитете по конкурентной политике Московской области	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Информационные технологии	\N	\N
9a59cfbf-389e-43a5-9e78-17c315a759a6	\N	Повышение эффективности закупок, осуществляемых у единственного поставщика	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Закупочная деятельность	\N	\N
6e2c6c81-831e-4587-b5dc-20fe02e20a8d	\N	Своевременное и надлежащее направление материалов для разработки позиции по объявленным/проведенным ЗИТ	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Информационные технологии	\N	\N
02a925e2-3ff1-4437-9247-8b3e2578a1fc	\N	Оптимизация выпуска документов, регламентирующих деятельность Учреждения	absolute_threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Документооборот	\N	\N
d88b4df7-8f9d-4d1f-a0b9-9cdcdc4547c4	\N	Правовая экспертиза проектов локальных актов Учреждения	absolute_threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-04 13:50:28.645886+00	Правовое обеспечение	\N	\N
c5e841f9-7320-413d-940b-65fa923f35d6	\N	Мониторинг закупочной деятельности заказчиков Московской области при осуществлении закупок в соответствии с Федеральным законом № 223-ФЗ	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Аналитическая деятельность	\N	\N
59aba96f-85a4-432a-b9d2-3eee9d95a904	\N	Актуальная и своевременная аналитика закупочных процедур	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Закупочная деятельность	\N	\N
f78f6f58-11bc-473e-ba2f-5481174ef5d4	\N	Осуществление мониторинга/оценки соответствия планов закупки по заказчикам МО	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Аналитическая деятельность	\N	\N
8550a4cc-620a-4579-825e-fd24b3c60513	\N	Осуществление мониторинга/оценки соответствия планов закупки по заказчикам МО	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Аналитическая деятельность	\N	\N
ebe7ae0b-4e77-46fe-8330-0d9b786eef61	\N	Мониторинг конкурентных закупок за счет средств бюджета	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Аналитическая деятельность	\N	\N
499af1e2-7ecd-41b6-a64f-1334ad07fd89	\N	Осуществление закупок заказчиками Московской области, в соответствии с Федеральным законом \n№ 223-ФЗ.	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Закупочная деятельность	\N	\N
dc2c5e07-90c6-4179-be98-c89d66fe2b53	\N	Контроль за размещением ежемесячной отчетности заказчиками МО	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Аналитическая деятельность	\N	\N
cf044e19-6b14-4956-b3f4-82fa31927487	\N	Рассмотрение закупок, позиций плана, в ЕАСУЗ в соответствии с п.1 ПП Вице-губернатора МО \nИ.Н. Габдрахманова	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Закупочная деятельность	\N	\N
13faee05-a8b0-4bf1-9d24-a894b570ff27	\N	Мониторинг закупок у единственного поставщика	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Аналитическая деятельность	\N	\N
4dac7f69-686f-47b6-b3c5-6fdf053b97fc	\N	Выполнение плановых показателей земельно-имущественных торгов центральных исполнительных органов власти и органов местного самоуправления муниципальных образований Московской области по выставлению имущества на торги (млн.руб.)	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Закупочная деятельность	\N	\N
be29de82-88f2-4b81-af9d-75f78aef670b	\N	Выполнение плановых показателей земельно-имущественных торгов центральных исполнительных органов власти Московской области и органов местного самоуправления муниципальных образований Московской области по выставлению имущества на торги (лотов)	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Закупочная деятельность	\N	\N
008e6517-8106-462b-a54d-f68c9f92919d	\N	Контроль за своевременным направлением центральными исполнительными органами власти Московской области и органами местного самоуправления муниципальных образований Московской области согласованных на МВК комплектов документов по объектам для публикации торгов	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Закупочная деятельность	\N	\N
23186bd9-70e1-4461-b0f1-e6f7b0518584	\N	Мониторинг конкурентных процедур, размещаемых на официальном сайте торгов	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Аналитическая деятельность	\N	\N
054de95b-5f8e-4fd2-9021-0249fadd1774	\N	Публикация торгов	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Закупочная деятельность	\N	\N
29da3e50-0e13-4f30-8b21-6913c2d8bbdc	\N	Рассмотрение документов                                               на Межведомственной комиссии                                     по вопросам земельно-имущественных отношений в Московской области (Имущество)	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Документооборот	\N	\N
5b22297d-439a-4b3e-a983-b8ae8c56182e	\N	Рассмотрение документов по нежилым помещениям, направленным для публикации торгов	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Закупочная деятельность	\N	\N
00a70b21-0ca0-4073-905b-ec50655fb4c5	\N	Рассмотрение документов на МВК и публикация торгов	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Закупочная деятельность	\N	\N
ab98a411-75c8-46e8-acf5-4a9de148602c	\N	Рассмотрение документов на Межведомственной комиссии по вопросам земельно-имущественных отношений в Московской области (земельные участки)	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Документооборот	\N	\N
9c0e74df-6264-4834-9ef6-3f71ebce7196	\N	Мониторинг решений, принятых Межведомственной комиссии по вопросам земельно-имущественных отношений в Московской области	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Аналитическая деятельность	\N	\N
4927f4a6-894b-4053-95cd-1f21a9afeb8c	\N	Рассмотрение документов на Межведомственной комиссии по вопросам земельно-имущественных отношений в Московской области (земельные участки коммерческого назначения)	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Документооборот	\N	\N
ad2368f8-342e-4bbe-a2d2-92371c0dfb45	\N	Развитие конкурентной среды в земельно-имущественных торгах в Московской области	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Закупочная деятельность	\N	\N
128e2024-c153-461d-b1bd-4309c5a0ed8b	\N	Эффективность проведения земельно-имущественных торгов	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Закупочная деятельность	\N	\N
be921cd5-fd9e-40ec-b9b4-8202af8b0cc5	\N	Направление ответов на запросы	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Прочие показатели	\N	\N
0926b6a9-5d8c-4eab-9335-fd5ce60faf7b	\N	Внесение изменений по объявленным торгам	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Закупочная деятельность	\N	\N
8791431f-82bd-477b-b4c9-a9b5211f8c50	\N	Мониторинг и аналитика земельно-имущественных торгов	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Аналитическая деятельность	\N	\N
7faf144d-78ee-40f4-b9dc-aa5bb18a567a	\N	Открытость и доступность земельно-имущественных торгов в Московской области	multi_threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Закупочная деятельность	\N	\N
6a947471-7f6d-4951-b7fd-129e7e0824ad	\N	Мониторинг включения лиц, уклонившихся от заключения договора, в реестр недобросовестных участников	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Аналитическая деятельность	\N	\N
1e1ca628-dae1-4efb-be74-d379c553eb75	\N	Контроль заключения договоров по итогам земельно-имущественных торгов	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Закупочная деятельность	\N	\N
b0e95aea-5cb3-4f25-85b8-f6f7b7394217	\N	Проведение заседаний и мониторинг договоров по ЗИТ	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Аналитическая деятельность	\N	\N
91aa04c3-0c94-4a65-aadc-4bfd36b3fc3f	\N	Предоставление отчетной документации о проектной деятельности	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Проектная деятельность	\N	\N
16b1cc80-0b99-4f59-9b59-722b329fb952	\N	Обеспечение внедрения принципов клиентоцентричности	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Прочие показатели	\N	\N
baad0426-5c07-4980-9e79-a8ad93c4c7c7	\N	Разработка документации в рамках реализации принципов клиентоцентричности	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Документооборот	\N	\N
2398622c-298f-4841-ae81-5b54f660609b	\N	Разработка стандартов построения моделей бизнес-процессов	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Прочие показатели	\N	\N
0296cbf2-b1f4-4d94-962e-6ba0d88a7d65	\N	Ведение Классификатора объектов закупок для обеспечения государственных нужд Московской области и муниципальных нужд	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Закупочная деятельность	\N	\N
2101e201-9fe6-496e-ac66-ae6a895ce238	\N	Ведение Классификатора объектов закупок (КОЗ)	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Закупочная деятельность	\N	\N
27d64c6e-2862-4ec5-b06c-8b05f0fdb60d	\N	Обеспечение эффективной кадровой работы	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Прочие показатели	\N	\N
6b629f4d-231a-497c-beb1-e997293af4a9	\N	Обеспечение методологической поддержки ЕАСУЗ	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Информационные технологии	\N	\N
448164ba-bf28-4abd-a60a-b26f37f734e7	\N	Обеспечение автоматизации процессов	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Прочие показатели	\N	\N
d54161aa-f111-4109-9d7f-96f47d2f5e82	\N	Обеспечение мониторинга и контроля закупок	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Аналитическая деятельность	\N	\N
28c849e4-11de-428e-b52e-76e971eb0f9a	\N	Обеспечение реализации положений Национального плана развития конкуренции	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Информационные технологии	\N	\N
ffe35e0a-5b4e-4d34-a909-db60ef5807b0	\N	Обеспечение деятельности по внедрению стандарта развития конкуренции в Московской области	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Информационные технологии	\N	\N
942809aa-3658-44af-b40a-9a51aa016a19	\N	Взаимодействие и координация исполнительных органов государственной власти в части развития конкуренции по выполнению мероприятий, предусмотренных в планах мероприятий («дорожных картах»)	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Информационные технологии	\N	\N
3839026a-a2a0-4d02-8f14-f3ca188cd397	\N	Участие в разработке и продвижении инициативных предложений	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Прочие показатели	\N	\N
b4deb77d-6298-453e-94ee-eb5689129a4d	\N	Обеспечение конкурентной среды	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Прочие показатели	\N	\N
4c262ac4-e331-48ba-a780-7992255ba83e	\N	Обеспечение деятельности по внедрению стандарта развития конкуренции в ОМСУ Московской области	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Информационные технологии	\N	\N
d0d3c706-c94c-49f5-8d6b-ecfabd63f364	\N	Обеспечение моделирования бизнес-процессов	binary_manual	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Прочие показатели	\N	\N
b0ef4a16-2947-49cb-bfb4-8c2aafc1b7fe	\N	Подготовка информационных материалов по популяризации ЗИТ	absolute_threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Информационные технологии	\N	\N
8b786300-9853-437d-bb8b-8361466d6df4	\N	Подготовка аналитических материалов по ЗИТ	absolute_threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Аналитическая деятельность	\N	\N
b94f3e05-f2be-405d-b1d6-1b0c1c1a92c0	\N	Взаимодействие и координация органов местного самоуправления Московской области в части развития конкуренции по выполнению мероприятий, предусмотренных в планах мероприятий («дорожных картах»)	binary_auto	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Информационные технологии	\N	\N
11a15b72-61e2-44a0-8246-dbc830a0d791	\N	Тестовый показатель	binary_manual	f	t	draft	1	\N	\N	ZaichkoVV	2026-05-03 06:46:13.06859+00	2026-05-03 06:46:13.06859+00	\N	\N	\N
ce9ab641-ba33-458f-a85b-ed3d682ea3bf	\N	Тестовый авто-показатель	binary_auto	f	t	draft	1	\N	\N	ZaichkoVV	2026-05-03 07:58:16.043712+00	2026-05-03 07:58:37.080289+00	Проектная деятельность	\N	\N
4fff8981-9470-4403-ab0f-3416961b3fcc	\N	Тестовый ручной показатель	binary_manual	f	t	draft	1	\N	\N	ZaichkoVV	2026-05-03 08:01:03.664518+00	2026-05-03 08:01:23.797829+00	Организационное обеспечение	\N	\N
77a555d2-3cd1-413a-9e36-01bd9e8a0592	\N	Тестовый составной показатель	multi_binary	f	t	draft	1	\N	\N	ZaichkoVV	2026-05-03 08:06:19.319399+00	2026-05-03 08:06:19.319399+00	\N	\N	\N
66b0e9cd-9ca3-46bc-afb6-c09ae3ecb043	\N	Тестовый пороговый показатель	threshold	f	t	draft	1	\N	\N	ZaichkoVV	2026-05-03 08:19:45.558322+00	2026-05-03 08:32:06.663537+00	Закупочная деятельность	\N	\N
90041b06-b5fc-4720-a618-deee79efa5e2	\N	Тестовый мульти-пороговый показатель	multi_threshold	f	t	draft	1	\N	\N	ZaichkoVV	2026-05-03 08:35:21.746282+00	2026-05-03 08:35:21.746282+00	\N	\N	\N
e7992c49-d33d-4132-ab4a-6c86c6ac2727	\N	Тестовый пороговый показатель 2	threshold	f	t	draft	1	\N	\N	ZaichkoVV	2026-05-03 08:48:03.139878+00	2026-05-03 08:48:03.139878+00	Закупочная деятельность	\N	\N
2f3e2ac3-0f38-42ec-91f4-e9a04da2937e	\N	Тестовый квартальный показатель	quarterly_threshold	f	t	draft	1	\N	\N	ZaichkoVV	2026-05-03 08:58:15.743919+00	2026-05-03 08:58:15.743919+00	Закупочная деятельность	\N	\N
f91cf436-86a9-462b-879e-d46eb20744ce	\N	Своевременная подготовка заключений по проектам нормативных правовых актов и регламентных документов, принятие которых отнесено к полномочиям Правительства Московской области	binary_manual	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Проектная деятельность	\N	\N
ce39cf54-effd-41bb-b1c9-71306611c75a	\N	Оптимизация локальных актов Учреждения	binary_manual	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Прочие показатели	\N	\N
8fe5e8a6-5a3d-4465-9e9d-64095c0affed	\N	Обеспечение моделирования бизнес-процессов	binary_manual	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Прочие показатели	\N	\N
6d61d322-0c8a-4eca-b547-a082ff46fb01	\N	Количество участников на торгах по Московской области	absolute_threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Закупочная деятельность	\N	\N
55145a3b-8bc7-45f4-a9ba-528bb25a21d3	\N	Осуществление закупок заказчиками Московской области, в соответствии с Федеральным законом от 18.07.2011 № 223-ФЗ «О закупках товаров, работ, услуг отдельными видами юридических лиц» (Закон № 223-ФЗ)	threshold	f	t	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-04 15:37:14.764916+00	Закупочная деятельность	\N	\N
67eebcb0-6142-41c9-8258-a1224cb5b912	\N	Соблюдение исполнительской дисциплины при работе в межведомственной системе электронного документооборота Московской области (МСЭД, ЗК МСЭД), сроков исполнения протокольных поручений, образующихся в ходе деятельности Учреждения, сроков исполнения приказов и распоряжений Учреждения, письменных и устных поручений руководства	binary_manual	t	f	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Общие показатели	\N	30
b797cd20-8301-43e0-a8f8-54a658537b1b	\N	Соблюдение правил и норм техники безопасности, охраны труда и противопожарного режима	binary_manual	t	f	active	1	2026-05-02	\N	import	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Общие показатели	\N	10
\.


--
-- Data for Name: kpi_role_card_indicators; Type: TABLE DATA; Schema: public; Owner: kpi_user
--

COPY public.kpi_role_card_indicators (id, card_id, indicator_id, criterion_id, weight, order_num, override_criterion, override_thresholds, override_weight) FROM stdin;
6cd63ed2-70a6-423c-9aa3-2d1cb070bd61	a0e7d562-2805-4f7a-becd-cb99cd91707f	55145a3b-8bc7-45f4-a9ba-528bb25a21d3	1d4a187b-fcad-4e59-8b98-b06998c85079	20	1	\N	\N	\N
32c7f6f4-f572-40bd-8cb6-15bd93fdd4e9	a0e7d562-2805-4f7a-becd-cb99cd91707f	30903993-c161-4568-a665-6914666a9ba5	f671c156-f32d-4b9e-b884-e3971382f491	20	2	\N	\N	\N
393afa12-3dad-4b4b-ab89-a0e6cbe095ad	a0e7d562-2805-4f7a-becd-cb99cd91707f	7a8940f7-f65e-4b73-a26b-0fd271f99378	ae9bb236-650a-4836-a853-6b2dffd048a9	10	3	\N	\N	\N
0a588cfd-9422-4eab-a32f-ac100d303ca1	a0e7d562-2805-4f7a-becd-cb99cd91707f	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	4	\N	\N	\N
63e7c3fc-f76a-47ec-ac84-81a100bfc49a	a0e7d562-2805-4f7a-becd-cb99cd91707f	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	5	\N	\N	\N
24087e12-c08c-45eb-8852-21e608ec251a	a0e7d562-2805-4f7a-becd-cb99cd91707f	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	6	\N	\N	\N
53f8719f-b2d9-4746-9592-09d9e97a3de8	004905af-db22-4aa1-98b2-3bc7b339306d	f2da6154-33a8-4f50-8317-7baa96e01502	a97fd204-36d9-4c9b-be91-4568b6d7b041	25	1	\N	\N	\N
2e4de6ba-50dd-4eae-9f16-1bcf409369ac	004905af-db22-4aa1-98b2-3bc7b339306d	02ff8f25-e182-430c-b4c3-22e02f990506	de5879f6-d710-4ac3-87f9-b4394644479a	25	2	\N	\N	\N
45d0ab41-4e69-40fa-adf7-12a874892be2	004905af-db22-4aa1-98b2-3bc7b339306d	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
69e72a3b-bf78-4480-a124-514e807317ad	004905af-db22-4aa1-98b2-3bc7b339306d	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
f6283d3b-52f8-492c-a525-731af718fa55	004905af-db22-4aa1-98b2-3bc7b339306d	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
25e0d88e-c714-4bf4-8e6d-5023ad7dbaa4	86d28759-3cd0-4f7d-84f8-c65fe309e9a1	9b54640c-a571-4fb9-bcb3-3768ed4d5c5b	6c84df79-aada-493c-b35f-8ecf63b0ffb9	25	1	\N	\N	\N
4369a7fd-e0df-496d-8e63-567024637fe3	86d28759-3cd0-4f7d-84f8-c65fe309e9a1	6ea4c1fe-0408-47a5-b38d-0bddb9f1879c	f1ad0f51-6818-44d9-af55-20768ab64197	15	2	\N	\N	\N
105fd570-5cf2-4274-85c3-cb9de6be10e6	86d28759-3cd0-4f7d-84f8-c65fe309e9a1	8496f8d1-fb40-44c4-8046-ea6070a8a6d8	23aa2fa8-b5f0-499d-8430-a88567263127	10	3	\N	\N	\N
beb7b7b9-7078-4213-b291-321d4548cf88	86d28759-3cd0-4f7d-84f8-c65fe309e9a1	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	4	\N	\N	\N
d5a8d1e5-c286-408b-92f3-dae3c7a0ce79	86d28759-3cd0-4f7d-84f8-c65fe309e9a1	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	5	\N	\N	\N
6b62c984-2b96-446d-a19f-4399bb663fdb	86d28759-3cd0-4f7d-84f8-c65fe309e9a1	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	6	\N	\N	\N
3467f26a-f390-4f80-bb32-f3a93664d9f5	8ff45751-83d5-48ec-8faa-ca8de13396b8	6d6660e4-7c55-45d7-a8bd-aad933855458	2284cee3-9709-47a1-a3a5-a8b3e51de27f	20	1	\N	\N	\N
bee4da09-fe50-4a38-b97d-7230c5a11388	8ff45751-83d5-48ec-8faa-ca8de13396b8	53099852-be21-4b46-b7b1-f33efa9e7445	8a2edda9-b5e2-4cb1-be55-597867d517b1	15	2	\N	\N	\N
21d3213e-58b8-465e-af96-50854722638f	8ff45751-83d5-48ec-8faa-ca8de13396b8	3e332410-3e15-4a8c-b3bd-74351e94ddd5	7c163300-f873-4d2f-bde2-e7cbf427e106	15	3	\N	\N	\N
ae4c777f-761d-4711-a80a-8cb741654d86	8ff45751-83d5-48ec-8faa-ca8de13396b8	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	4	\N	\N	\N
379a6698-fc80-42bc-964e-cda0eaebe73d	8ff45751-83d5-48ec-8faa-ca8de13396b8	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	5	\N	\N	\N
d6277d90-9d50-4f17-9338-a1cd687bb6a2	8ff45751-83d5-48ec-8faa-ca8de13396b8	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	6	\N	\N	\N
d264842a-cdbb-4524-9f92-2e809741e534	40c66eba-ad98-4445-9538-725cabef18dd	fc71cac0-b6ed-416d-a9af-e0fc192f36a4	f7701bf4-988e-49c3-9a4d-ad44b31a6ec8	25	1	\N	\N	\N
2c829f95-827d-4721-a71e-96a625ca6788	40c66eba-ad98-4445-9538-725cabef18dd	159bd802-31a1-484f-ba1d-cff5da969ae1	2585fde0-bfb3-4520-bf24-f1e7dc9ac64a	25	2	\N	\N	\N
ebe663bc-d386-44ea-a68c-6c4febbf1fc8	40c66eba-ad98-4445-9538-725cabef18dd	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
823db63c-62b3-4781-88a6-1f631dbd18b5	40c66eba-ad98-4445-9538-725cabef18dd	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
0cd3cf02-8586-4595-be39-837e903c1538	40c66eba-ad98-4445-9538-725cabef18dd	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
6c95d65a-7d4d-4351-a6e6-f6d52d1f3559	006779fa-af34-4c73-aff7-4a2ba6df035f	ed8c11a7-cd21-484c-be06-b2ddd19ebe6a	41c49836-94bd-4b25-983b-b8992b6a59dc	20	1	\N	\N	\N
50f4616d-8795-48fc-a3e7-ee7f6796583c	006779fa-af34-4c73-aff7-4a2ba6df035f	21fe0a29-3f97-426a-8be4-5f230a3299bf	e1437ef3-95e4-4c37-9858-766fae8f7ae9	20	2	\N	\N	\N
1fcddcd6-c558-42b0-b3fe-ce596510f10a	006779fa-af34-4c73-aff7-4a2ba6df035f	b92ac9eb-3d24-4044-9834-653aaa66524a	9295be62-0ef8-49d7-a0d5-bedf804819c8	10	3	\N	\N	\N
98a9d441-0eb6-458f-b8bd-3ca27290fcd8	006779fa-af34-4c73-aff7-4a2ba6df035f	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	4	\N	\N	\N
4f95cc6f-ac92-44ba-9eed-6afc5672e66e	006779fa-af34-4c73-aff7-4a2ba6df035f	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	5	\N	\N	\N
bfc6c8b4-880c-4825-8cd6-02379427849d	006779fa-af34-4c73-aff7-4a2ba6df035f	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	6	\N	\N	\N
2997c2fa-79d6-47eb-a92f-09ef9c541f19	7c097b0b-8084-4fbc-986d-f81b4927f8a8	72bd3fe5-1423-421f-882c-4babc483b94a	9298f166-0df8-4ba5-bfb1-801f752ad6ab	10	1	\N	\N	\N
b22eb870-8fdb-4c9b-85f6-bf7578edea80	7c097b0b-8084-4fbc-986d-f81b4927f8a8	11d82078-6cb5-428d-af50-cff69855f84e	62dee10d-b3ae-41c1-b933-708b52800535	10	2	\N	\N	\N
2efa711e-3852-41e4-b27b-f13afd7ab3f9	7c097b0b-8084-4fbc-986d-f81b4927f8a8	72219071-2fbf-4bd8-8d92-61bc2eca3309	6d8ab7e0-187b-46f1-a42c-5346151b8dfc	30	3	\N	\N	\N
80e4d37e-3a74-4ebe-8858-7ccf176bb713	7c097b0b-8084-4fbc-986d-f81b4927f8a8	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	4	\N	\N	\N
fc83e99a-5fe1-4f30-9797-b6675c8a5b71	7c097b0b-8084-4fbc-986d-f81b4927f8a8	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	5	\N	\N	\N
8ca6c215-0074-48ec-a871-8006cea53a82	7c097b0b-8084-4fbc-986d-f81b4927f8a8	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	6	\N	\N	\N
45336cb4-8518-4f9d-8071-859ea5cb116f	584b6634-3d14-4fea-8428-f3652c3bfe42	98f1a694-2b7c-4ac7-9bc6-922d91216812	826ca25d-5a20-426d-9e75-8d1a99d8bda9	5	1	\N	\N	\N
8fa39698-79b7-4ff9-b8fd-621fc3295014	584b6634-3d14-4fea-8428-f3652c3bfe42	a62f3183-a15f-4c51-bda8-9f9cf10ee2aa	1a5b0430-fb62-4218-8bed-7979ea151596	10	2	\N	\N	\N
644ad1fa-f687-4148-9351-d35a8bda26b3	584b6634-3d14-4fea-8428-f3652c3bfe42	602ce79b-f524-4656-81bf-5ba71bebfdce	15525b46-9d38-46d0-9903-63d9cb184401	25	3	\N	\N	\N
9cf0cea6-dbcc-473f-8612-f8ca29a2e6f4	584b6634-3d14-4fea-8428-f3652c3bfe42	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	4	\N	\N	\N
db423e13-8cbb-4fdf-acfa-f2ad281d453b	584b6634-3d14-4fea-8428-f3652c3bfe42	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	5	\N	\N	\N
9150fb0f-80b5-4f1d-b47c-b1a509b0d01d	584b6634-3d14-4fea-8428-f3652c3bfe42	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	6	\N	\N	\N
79c10b83-9ffc-41c8-96c4-8ab5d12b8694	d1e3b154-6347-46ee-91d1-63f4128c97a2	00b0c8fc-29a8-4783-8eb8-628adabce00f	b261a9d0-33b6-489a-a6ec-bdf1d6861dfa	30	1	\N	\N	\N
52a2a78c-618f-4e61-8115-389b2208b397	d1e3b154-6347-46ee-91d1-63f4128c97a2	9ce10475-3a61-443b-a3e0-bb3f408fea29	a7f227d3-3fa0-486b-88ee-19c0bd4130c8	10	2	\N	\N	\N
d55a3cc0-9afd-43b9-a1c3-ed649ce8f7a7	d1e3b154-6347-46ee-91d1-63f4128c97a2	cfbd58ae-8d53-4c14-8388-3328222ab69e	edab3cc1-15f4-4e7f-965e-cd0b47dfb3f3	10	3	\N	\N	\N
c1fe1d18-5db5-4232-b303-224670087d07	d1e3b154-6347-46ee-91d1-63f4128c97a2	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	4	\N	\N	\N
c475f6a8-554a-45f8-b257-9dcf5933a78c	d1e3b154-6347-46ee-91d1-63f4128c97a2	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	5	\N	\N	\N
6d552d90-2054-4cc4-9866-10da13267698	d1e3b154-6347-46ee-91d1-63f4128c97a2	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	6	\N	\N	\N
a89d2245-8a88-4230-bdc0-af426dd249c2	f576e165-0a86-4160-bbeb-006d74f400f8	54ab991b-8cf2-44de-8f05-2c2a18b92a4c	654fd3b6-0bd9-428a-b228-2762e2938eeb	30	1	\N	\N	\N
780f9cd3-08da-4a5c-9183-c63c088d3f01	f576e165-0a86-4160-bbeb-006d74f400f8	41e00483-fde9-4f6e-88be-3b06b9a0eaba	30155225-fe5c-485d-a428-102d4113fad3	10	2	\N	\N	\N
51311024-51d3-4730-b440-a39f8499e0c1	f576e165-0a86-4160-bbeb-006d74f400f8	fb740b15-7fce-441b-97f3-08d1ef494390	f5422ae5-fe48-4435-900e-76cd7806c27c	10	3	\N	\N	\N
8c7244ae-cad0-4e94-98fc-8be736e5de7c	f576e165-0a86-4160-bbeb-006d74f400f8	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	4	\N	\N	\N
0640d149-b1ed-45cc-8afb-80e4a3494b13	f576e165-0a86-4160-bbeb-006d74f400f8	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	5	\N	\N	\N
c6e9da8f-cb84-41ba-9b23-333707ffcf22	f576e165-0a86-4160-bbeb-006d74f400f8	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	6	\N	\N	\N
ca36041a-9488-4105-aea0-23369e360116	9581bb61-2ef5-4fa9-9c13-ba16a7a42a11	8167f3ce-9eec-46fb-8214-d7b5b6b04b48	4c3c26ae-ca3a-42c4-a4e8-db87a9d9902d	20	1	\N	\N	\N
a4a0ee31-40d1-4496-94a8-1f3b7a3a8070	9581bb61-2ef5-4fa9-9c13-ba16a7a42a11	19a71e9c-5d5d-4336-87ba-9473103e5ff5	9cc7d75c-89f4-45d6-8aaf-5743ebe24777	20	2	\N	\N	\N
ac12f875-e716-4483-b10a-9cd3892f958e	9581bb61-2ef5-4fa9-9c13-ba16a7a42a11	349cff7c-981a-45ec-bd64-cadf37f0c221	a1b01523-6a88-4e42-a80a-a8c6ec8e5cfd	10	3	\N	\N	\N
fdef839f-041d-4c1a-85e9-2d867f2fa935	9581bb61-2ef5-4fa9-9c13-ba16a7a42a11	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	4	\N	\N	\N
021a86f1-fb24-4c7d-a5a0-0bf466ba030b	9581bb61-2ef5-4fa9-9c13-ba16a7a42a11	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	5	\N	\N	\N
6f13c2b1-e860-4316-adf4-bc06a5b1b607	9581bb61-2ef5-4fa9-9c13-ba16a7a42a11	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	6	\N	\N	\N
17881485-220f-4466-99cc-c45ea083ca94	f8771d3d-fa0e-4b9d-948b-3ea36ee0a143	ed8c11a7-cd21-484c-be06-b2ddd19ebe6a	f75a99ac-d8e9-4f6b-a977-14c829bf2162	25	1	\N	\N	\N
559733f8-eef8-4173-9f14-ca1f050e1d6c	f8771d3d-fa0e-4b9d-948b-3ea36ee0a143	84ea8532-c84b-46d0-b6f5-d0598cbcdb39	ddb4c45b-195e-4e8b-86ba-42fc9a5dd1fd	25	2	\N	\N	\N
7e95761a-8545-4b46-819f-009bc74ec00b	f8771d3d-fa0e-4b9d-948b-3ea36ee0a143	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
ca170aca-b001-4ead-b237-a754fcfd5307	f8771d3d-fa0e-4b9d-948b-3ea36ee0a143	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
e3c7ae33-a9ee-4989-b60f-ce178749d131	f8771d3d-fa0e-4b9d-948b-3ea36ee0a143	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
5d67e266-b56a-45d0-a755-d9e9dcad774b	7746dc41-71bd-4d16-80fc-878a562b5540	e8bd6c80-3405-4639-99e3-6cf7039cfa3d	f654b26d-01fa-4b0c-8d2d-f86458e2d770	15	1	\N	\N	\N
7d5b5738-4e80-454a-bec6-96bfc4bb0afb	7746dc41-71bd-4d16-80fc-878a562b5540	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	2	\N	\N	\N
6ae5e7f3-fae7-45ab-b36c-f6e4a2ae146b	7746dc41-71bd-4d16-80fc-878a562b5540	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	3	\N	\N	\N
cefde3ca-a3be-4c03-84af-b092000d6a25	7746dc41-71bd-4d16-80fc-878a562b5540	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	4	\N	\N	\N
ba177720-f37d-4919-a9f3-e8fd4bcf1ebf	9a8f463a-ab55-44c0-9481-6e910d0344cf	e8bd6c80-3405-4639-99e3-6cf7039cfa3d	05cbb922-173d-4504-abd9-2b176a32a3ab	10	1	\N	\N	\N
59aed846-034f-48e5-b6b0-d0d94abce3ba	9a8f463a-ab55-44c0-9481-6e910d0344cf	abd8f253-6109-43f3-9b7f-f2154c99edf7	9c48a7fb-8f04-4e38-a0e7-82a1a6000191	5	2	\N	\N	\N
4827735f-dba5-4a9a-87cc-b1d5bb18dcc7	9a8f463a-ab55-44c0-9481-6e910d0344cf	5aa47867-1959-4521-ae5e-a56e4a3e9e03	60f07122-26fc-4442-9756-c4d3757b6ae6	10	3	\N	\N	\N
ff9df60d-75cb-46b6-9f58-b32f973e48ba	9a8f463a-ab55-44c0-9481-6e910d0344cf	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	4	\N	\N	\N
393988f5-ee1b-4be4-b6e2-6f1f1b90a197	9a8f463a-ab55-44c0-9481-6e910d0344cf	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	5	\N	\N	\N
47a309cd-dd26-4850-86e7-d4ebec048992	9a8f463a-ab55-44c0-9481-6e910d0344cf	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	6	\N	\N	\N
a071371d-5690-41d5-9751-d9809e1d69ca	1573921f-1723-4801-bbd6-f3d0716ab476	0acf0bcf-7297-42fd-931d-3470eb11fe85	b55c952a-a4c0-4513-9d37-dd17d3cffe52	20	1	\N	\N	\N
a8dffa90-f9d7-4afd-9ae3-c87de1ef4f4b	1573921f-1723-4801-bbd6-f3d0716ab476	349cff7c-981a-45ec-bd64-cadf37f0c221	a1b01523-6a88-4e42-a80a-a8c6ec8e5cfd	10	2	\N	\N	\N
ccf9bcf6-857a-4f21-8385-fd4770b14bfd	1573921f-1723-4801-bbd6-f3d0716ab476	19a71e9c-5d5d-4336-87ba-9473103e5ff5	9cc7d75c-89f4-45d6-8aaf-5743ebe24777	20	3	\N	\N	\N
49c52150-c2a5-42e4-995a-da1a86a2325a	1573921f-1723-4801-bbd6-f3d0716ab476	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	4	\N	\N	\N
e316ed69-33e1-45ac-8833-83d50751f98d	1573921f-1723-4801-bbd6-f3d0716ab476	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	5	\N	\N	\N
0d4f694e-be2c-4d17-a883-01e8f99c6ef1	1573921f-1723-4801-bbd6-f3d0716ab476	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	6	\N	\N	\N
cc944417-8d2f-43d0-936b-93a3c5aaaac8	8395a568-671e-41bf-a567-ff3793a94d55	52a82268-e352-4953-965f-b282350cc65d	9f14effc-21aa-4801-bb66-19523534cca1	20	1	\N	\N	\N
43f4937e-be95-4b6e-a705-359237bd5cc6	8395a568-671e-41bf-a567-ff3793a94d55	cd5f98b5-a9f8-4720-a731-901039db3787	f95ffa10-f956-47b6-bb9d-3fcda3e292ab	15	2	\N	\N	\N
68a73ebf-f2d3-4319-8beb-f96d91bd3f03	8395a568-671e-41bf-a567-ff3793a94d55	3d5ddd26-a2d8-45e7-9d26-4436be18cdbd	9bdc2009-28cb-4339-9418-8a8bb2ddbd52	15	3	\N	\N	\N
c3fc71f5-b6fc-4399-91da-90c4c112d5af	8395a568-671e-41bf-a567-ff3793a94d55	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	4	\N	\N	\N
b51842b3-9766-4b4a-aac8-c0c8d1b38630	8395a568-671e-41bf-a567-ff3793a94d55	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	5	\N	\N	\N
7cdfd183-8722-4b38-9258-f876c7a408dc	8395a568-671e-41bf-a567-ff3793a94d55	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	6	\N	\N	\N
947f2bac-1954-4517-8c17-77a9a56b94df	6bc8d635-eb11-4375-896c-272eea81d9c9	d1a3708c-b0d1-4907-be6e-166c17d21f8d	ec46fe5c-043b-4bbe-b305-a09a09ffd37c	15	1	\N	\N	\N
538ed827-43b0-4f75-a3f2-0dd81dde9b47	6bc8d635-eb11-4375-896c-272eea81d9c9	41a96d1c-812e-4022-9ccc-2f2c6197eff4	1aba3471-449c-4b7a-8d3f-26ce69c1aa33	15	2	\N	\N	\N
d47f0038-2493-4f9c-835a-0284b2adc866	6bc8d635-eb11-4375-896c-272eea81d9c9	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
a1962ee8-39da-4bb6-9f58-346f9cb6739f	6bc8d635-eb11-4375-896c-272eea81d9c9	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
6483808f-ea29-4761-ba73-723c0e2c07f0	6bc8d635-eb11-4375-896c-272eea81d9c9	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
e08b17ef-ef63-4738-9c97-c465e96b296a	0f8f4b37-1aa0-4232-acdc-f63f8d89ec1e	d1a3708c-b0d1-4907-be6e-166c17d21f8d	f6a09f75-aa2d-4d40-ba0d-1b2afe2a39f7	15	1	\N	\N	\N
e1caf30e-401d-4d12-a745-25fb35a52650	0f8f4b37-1aa0-4232-acdc-f63f8d89ec1e	41a96d1c-812e-4022-9ccc-2f2c6197eff4	5a3757e7-397e-441f-ab79-fa643b17d8b6	15	2	\N	\N	\N
5f9f34b6-2471-4a0f-9fb4-32d77a67004f	0f8f4b37-1aa0-4232-acdc-f63f8d89ec1e	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
563e14e2-b019-427b-bbca-909ca08a8366	0f8f4b37-1aa0-4232-acdc-f63f8d89ec1e	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
11769da2-4f5b-45d0-877c-d76240beec94	0f8f4b37-1aa0-4232-acdc-f63f8d89ec1e	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
a9657b16-61dc-4aa7-9844-f0a5cb86a460	9b2cc5b1-6606-44f3-9d3a-f99c027d50fa	9b54640c-a571-4fb9-bcb3-3768ed4d5c5b	f66482fa-288a-4dd4-9439-4e178b645a68	30	1	\N	\N	\N
c493722c-3275-4397-8a17-742e67050867	9b2cc5b1-6606-44f3-9d3a-f99c027d50fa	6d6660e4-7c55-45d7-a8bd-aad933855458	9c77cee7-333a-4c1f-8903-e033c0745024	20	2	\N	\N	\N
3ab46f1b-59df-4825-a079-7d67d3d98c5a	9b2cc5b1-6606-44f3-9d3a-f99c027d50fa	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
c72fc0d5-6185-4c18-bd3f-37e02df34e40	9b2cc5b1-6606-44f3-9d3a-f99c027d50fa	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
53f2ecd6-1aec-4d55-92cb-ae32de609a36	9b2cc5b1-6606-44f3-9d3a-f99c027d50fa	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
98a888b0-119d-43e8-a76c-0d0e3ce79a79	484ac7d9-c0fb-4f08-9fb8-34888050702e	82fbb17a-be9d-441d-8dde-1da428e4a69e	a7722065-0300-4190-8463-7748b09e5b6a	50	1	\N	\N	\N
307e3e33-8a80-442f-ae65-2b5e69be129d	484ac7d9-c0fb-4f08-9fb8-34888050702e	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	2	\N	\N	\N
5155d5de-3099-49cf-9bac-933145a23fd0	484ac7d9-c0fb-4f08-9fb8-34888050702e	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	3	\N	\N	\N
3f6baed0-d569-4279-9142-342274d3f355	484ac7d9-c0fb-4f08-9fb8-34888050702e	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	4	\N	\N	\N
8537b4bf-cd42-4938-b803-615a477c2e0d	894b3660-1c43-49f8-99ba-fc346c8addb6	d9aa6ebe-6215-4ada-b35e-302f4932707e	e2846331-d195-4a0c-8d96-faf93407b510	50	1	\N	\N	\N
a9b568ae-29b5-49f6-8d05-e1da7d70f407	894b3660-1c43-49f8-99ba-fc346c8addb6	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	2	\N	\N	\N
c473dfef-cc51-4267-8724-c3b43b130c80	894b3660-1c43-49f8-99ba-fc346c8addb6	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	3	\N	\N	\N
b63a7223-a037-4325-838e-862cd68f483e	894b3660-1c43-49f8-99ba-fc346c8addb6	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	4	\N	\N	\N
01d94d0d-b269-4491-91f4-aa7a966d0901	2b26d243-0800-4d8b-b134-21f9ed05ce6c	90105cbc-ea6b-498a-bb5a-b0198817d796	4ec74ea4-75c4-4f29-9ef6-bd99c639019f	30	1	\N	\N	\N
6c059b08-7581-49e4-93a2-f23779bc4aae	2b26d243-0800-4d8b-b134-21f9ed05ce6c	6d6660e4-7c55-45d7-a8bd-aad933855458	eef64a17-2ef9-4d3d-8b8e-2d1558885863	20	2	\N	\N	\N
baa2ba33-fe24-4f09-a6bb-4dde2c069882	2b26d243-0800-4d8b-b134-21f9ed05ce6c	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
917bf8e7-7ba3-4c69-ae20-b5f665f59b14	2b26d243-0800-4d8b-b134-21f9ed05ce6c	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
bab56e06-ba83-4956-b084-516e2fa83143	2b26d243-0800-4d8b-b134-21f9ed05ce6c	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
ee3ff51e-1206-4030-a042-809a02780cd6	6c45d625-3816-4321-943e-1281b6013cea	6d6660e4-7c55-45d7-a8bd-aad933855458	71552712-f858-4c32-bcc7-5ec17df4b0db	30	1	\N	\N	\N
593219b3-d581-470b-96ad-e321bc185eb9	6c45d625-3816-4321-943e-1281b6013cea	867a139f-1901-4f5e-a8f3-f4dfb2fb00d1	376504fb-3349-4890-a2ca-d865d70e7433	20	2	\N	\N	\N
9caada45-7b06-4aee-bfb6-2549e5a56b65	6c45d625-3816-4321-943e-1281b6013cea	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
315d18d3-9718-419f-a38a-1cfe9b17a819	6c45d625-3816-4321-943e-1281b6013cea	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
64edde16-c577-4f9d-af92-58d73114f01f	6c45d625-3816-4321-943e-1281b6013cea	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
5d69b1fc-79ca-407e-babb-e060b48acdf5	d6dfd535-53e8-4fea-89b6-f63f95f37d4f	bba045b2-258f-480c-95bc-0831c0cec21e	fadd1f75-e349-419d-b76e-ff15b350b523	30	1	\N	\N	\N
875b927b-e48c-4a2f-ab8f-df23d4295384	d6dfd535-53e8-4fea-89b6-f63f95f37d4f	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	2	\N	\N	\N
ff03b2db-f4ca-466d-a821-f77c9812233e	d6dfd535-53e8-4fea-89b6-f63f95f37d4f	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	3	\N	\N	\N
9e4024bc-fd1c-420d-8d7e-f084695fee02	d6dfd535-53e8-4fea-89b6-f63f95f37d4f	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	4	\N	\N	\N
455b2551-c48c-420c-b275-8a019a7134de	2a838846-99b3-407c-8168-65cf3399922b	6d6660e4-7c55-45d7-a8bd-aad933855458	8a00daa4-3394-42fe-ad76-260d66b029e9	30	1	\N	\N	\N
c6d38038-cbf6-4d16-ab96-b6987335ca0a	2a838846-99b3-407c-8168-65cf3399922b	14114eba-5b29-4db9-88ce-4f99ced6fb34	aad78807-f973-4d4c-9656-d6b86713447a	20	2	\N	\N	\N
89f88bef-79db-4c74-bd4f-2bb2dcdb6647	2a838846-99b3-407c-8168-65cf3399922b	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
e0bb7b82-6a75-4c8b-968b-06c11a7371fa	2a838846-99b3-407c-8168-65cf3399922b	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
23ed0ad9-e4d3-4261-86f0-0e441c919c11	2a838846-99b3-407c-8168-65cf3399922b	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
35a350db-cc3f-403d-a863-5d739b0f9de2	f54d69f8-5cad-4e5e-9a0f-beee4e73bed9	6d6660e4-7c55-45d7-a8bd-aad933855458	8a00daa4-3394-42fe-ad76-260d66b029e9	30	1	\N	\N	\N
c70f0486-e090-44f2-a9e2-bc2e885b1d78	f54d69f8-5cad-4e5e-9a0f-beee4e73bed9	bba045b2-258f-480c-95bc-0831c0cec21e	fce01214-77fb-43c9-ac8c-17bbf57c2403	20	2	\N	\N	\N
0004d695-55da-4d2a-a962-cb2a1533105e	f54d69f8-5cad-4e5e-9a0f-beee4e73bed9	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
a7f99841-99be-41eb-aa3c-6768d767a631	f54d69f8-5cad-4e5e-9a0f-beee4e73bed9	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
5c71acc7-4101-40c6-b8a2-d1911f76df21	f54d69f8-5cad-4e5e-9a0f-beee4e73bed9	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
b43d4bc1-27c2-4116-a84c-2187ea826957	8d9aadcd-258b-457a-9e3b-06e78ceeec5e	6ea4c1fe-0408-47a5-b38d-0bddb9f1879c	0614e7cc-2201-4398-8de0-17c9b4e45738	30	1	\N	\N	\N
78bbf86e-fd45-4f59-a926-2eb02987fb27	8d9aadcd-258b-457a-9e3b-06e78ceeec5e	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	2	\N	\N	\N
a6d52413-0221-4fba-b344-bb8095a2ab51	8d9aadcd-258b-457a-9e3b-06e78ceeec5e	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	3	\N	\N	\N
2fa68fe0-c022-48f3-91d4-9a5726663b4f	8d9aadcd-258b-457a-9e3b-06e78ceeec5e	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	4	\N	\N	\N
572c9d6d-dec4-4dcd-a2ba-5f04310e4f76	0c566597-6438-4dfb-876f-138e07cd1d12	6ea4c1fe-0408-47a5-b38d-0bddb9f1879c	0614e7cc-2201-4398-8de0-17c9b4e45738	25	1	\N	\N	\N
02df66c4-7f55-469b-8a42-e73d641ccad4	0c566597-6438-4dfb-876f-138e07cd1d12	6d6660e4-7c55-45d7-a8bd-aad933855458	71552712-f858-4c32-bcc7-5ec17df4b0db	25	2	\N	\N	\N
715698e9-06f5-4b1a-a84c-52e35d37d79b	0c566597-6438-4dfb-876f-138e07cd1d12	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
8cacff89-89b7-4a86-9afd-7cff9833763c	0c566597-6438-4dfb-876f-138e07cd1d12	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
4bdc0ad5-7f66-4e52-a997-0f8e78810bc0	0c566597-6438-4dfb-876f-138e07cd1d12	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
be084f7f-8a82-4e6c-8420-c4c88dc635d3	ed0e02fd-e22d-41c6-828b-c1a32724518b	d1e6f2f6-7b2a-4d58-9894-be723bc0afe2	d39f1e9d-2813-492c-9911-f872ce50265a	30	1	\N	\N	\N
b714f4fb-38fd-48b0-b035-629260995b7a	ed0e02fd-e22d-41c6-828b-c1a32724518b	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	2	\N	\N	\N
17883199-5705-43f9-8fff-600b0e7c69b7	ed0e02fd-e22d-41c6-828b-c1a32724518b	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	3	\N	\N	\N
d884ff64-b154-4970-b8d5-68da956a693b	ed0e02fd-e22d-41c6-828b-c1a32724518b	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	4	\N	\N	\N
07d449f8-921d-4a65-a063-f80145ca1e0f	f7dc08fd-5867-4d75-a356-e28dcf3b7326	bba045b2-258f-480c-95bc-0831c0cec21e	bf6f4965-9a14-4d11-a577-ad266ff35c89	30	1	\N	\N	\N
c5d8b4ee-3467-41a8-bb7d-cb6ab0e84714	f7dc08fd-5867-4d75-a356-e28dcf3b7326	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	2	\N	\N	\N
4e10ee2b-630c-4408-9a5a-99c22c98bc7c	f7dc08fd-5867-4d75-a356-e28dcf3b7326	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	3	\N	\N	\N
c79ff0a6-c343-4af1-93af-3f66ac92d8d9	f7dc08fd-5867-4d75-a356-e28dcf3b7326	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	4	\N	\N	\N
a08bd5c4-2ac1-46c6-9ec9-808ccc23e39d	e6d892b1-5dc7-4a90-8c2d-677fc31459aa	d1e6f2f6-7b2a-4d58-9894-be723bc0afe2	d39f1e9d-2813-492c-9911-f872ce50265a	30	1	\N	\N	\N
dbccb566-6f14-492d-8865-1d5ab8566254	e6d892b1-5dc7-4a90-8c2d-677fc31459aa	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	2	\N	\N	\N
46f65088-97ac-4bf6-abe4-d404aa953d79	e6d892b1-5dc7-4a90-8c2d-677fc31459aa	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	3	\N	\N	\N
9223bd2c-2a34-4aa7-8432-b2fb7dd6c7d5	e6d892b1-5dc7-4a90-8c2d-677fc31459aa	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	4	\N	\N	\N
2c48ffbe-7420-4c88-9c0c-30dd8d469e78	2f89f89d-51ad-482c-b274-a5b22edfb8d7	f91cf436-86a9-462b-879e-d46eb20744ce	00367921-f169-480d-ad5e-265160b2705f	25	1	\N	\N	\N
a8ef95b1-05ea-463d-b955-23668df86461	2f89f89d-51ad-482c-b274-a5b22edfb8d7	f173f4b9-abc5-412c-9f73-17f24335ccd2	51135515-c5ee-468f-b1e6-1a1cdfee2fde	25	2	\N	\N	\N
a33e7f8f-74ab-446a-8836-75a3491c3a4a	2f89f89d-51ad-482c-b274-a5b22edfb8d7	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
4b0219c7-31da-460a-be87-a537faa90696	2f89f89d-51ad-482c-b274-a5b22edfb8d7	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
28803c55-7797-4bf8-92c6-f3fcb7d639e3	2f89f89d-51ad-482c-b274-a5b22edfb8d7	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
6c9b1dc2-8c3b-412d-97d0-24e57e8461a2	5813e864-a45c-468c-8090-915ae6767c5a	ce39cf54-effd-41bb-b1c9-71306611c75a	957b1cd1-7640-4689-89c3-12bf1e14d0e9	25	1	\N	\N	\N
92e01dbd-5a87-4b02-bf08-9e79c3b6ee4f	5813e864-a45c-468c-8090-915ae6767c5a	ba6bba4c-c116-4289-8ec5-2cd12b148878	bda58b01-799c-433a-a235-f6851653692c	25	2	\N	\N	\N
4fcf1918-aac4-4d80-bc9e-1f0bcf8e6aac	5813e864-a45c-468c-8090-915ae6767c5a	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
78a766ce-43b8-4e69-a37c-17383c1ae139	5813e864-a45c-468c-8090-915ae6767c5a	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
0e96957d-ca58-4cff-b950-cc02ba100740	5813e864-a45c-468c-8090-915ae6767c5a	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
93cda82d-4721-497c-8e12-4cd585d4c654	b2b625a4-280d-49f4-8fe4-9935f66c9ffc	3fd7828f-995e-4894-bfb8-4ee8462af6bc	1c0bf8b9-a76d-4446-95aa-125ec58d2625	25	1	\N	\N	\N
109cb6e0-ea01-488a-ad52-35b16c1c63cd	b2b625a4-280d-49f4-8fe4-9935f66c9ffc	558d50d0-ee17-48da-826f-b3e76faed255	74be8119-ae4a-4a51-bf13-61ee701ca6ea	25	2	\N	\N	\N
38ad3633-0d8b-4961-b973-1c0f368ccc75	b2b625a4-280d-49f4-8fe4-9935f66c9ffc	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
83a2ee1b-01fe-4b73-89c4-242020c5c636	b2b625a4-280d-49f4-8fe4-9935f66c9ffc	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
f6fe9a17-3708-44f7-a986-4facbde3ea09	b2b625a4-280d-49f4-8fe4-9935f66c9ffc	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
ad997758-e384-4d65-a785-3fa795ff812c	464d48f0-4372-4a54-9054-707b1be151b9	73e28219-ac45-471d-96c2-da47a8cf298c	7c084476-5c04-446c-88f8-a83d6d69c825	25	1	\N	\N	\N
af3dcfea-1820-43e5-9828-a8219f98fb9b	464d48f0-4372-4a54-9054-707b1be151b9	5e1c2ce2-a597-4bad-a22c-0e224d0e1135	3aaae7b2-4b33-4b34-a00d-7235e60dee4a	25	2	\N	\N	\N
e1b3fa7d-e394-4326-a7f2-f647b70091e4	464d48f0-4372-4a54-9054-707b1be151b9	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
a4dcb579-f186-4897-b962-7246f1a9a090	464d48f0-4372-4a54-9054-707b1be151b9	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
211c7676-8d00-48ad-924f-5a8bc89aa73d	464d48f0-4372-4a54-9054-707b1be151b9	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
6de5418e-28b2-4043-8509-388636fe377d	4bede7fc-8fa9-45c4-a3a0-28764063bd02	0eb1454a-191c-4288-b37e-d19a0de4657d	b2948b87-e88d-4c4e-9dd8-2117cdaf2c7a	25	1	\N	\N	\N
5f7fb3f4-c0b0-4a84-969f-b7e66882bf6f	4bede7fc-8fa9-45c4-a3a0-28764063bd02	9c917107-ad5a-4272-bd99-4480fbef796c	41b81eb0-2a66-4b3e-8bae-3cbdd453320b	25	2	\N	\N	\N
35a7058f-66ed-462e-861c-180d48f26e64	4bede7fc-8fa9-45c4-a3a0-28764063bd02	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
30f77d80-fcd6-4634-b788-8509bf0b34a8	4bede7fc-8fa9-45c4-a3a0-28764063bd02	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
00d4b6c9-4910-48f4-ba36-cc093542fd76	4bede7fc-8fa9-45c4-a3a0-28764063bd02	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
9cef4161-b52c-4503-8125-ce0bcbe960b1	d22d4b6c-a012-4cf1-8f1a-ed1060bfef96	db791a71-da9b-4fc6-8dbe-903d43434a65	0c01023c-3bc5-4fe1-bd0a-1d62a5d08be5	30	1	\N	\N	\N
d55dc603-1697-4079-995e-ab814d2191c3	d22d4b6c-a012-4cf1-8f1a-ed1060bfef96	a71fe6f2-273b-4359-a772-449bbf7efe6b	bcec6908-496d-4835-ab08-c5d0aa7ce686	20	2	\N	\N	\N
fe55deca-d535-4393-8fab-608737a9dde7	d22d4b6c-a012-4cf1-8f1a-ed1060bfef96	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
dd058339-d175-49f9-ad05-9cb898567b60	d22d4b6c-a012-4cf1-8f1a-ed1060bfef96	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
d4836a81-262b-4f27-9be7-d6623831b475	d22d4b6c-a012-4cf1-8f1a-ed1060bfef96	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
09553825-f199-466a-900a-20965ae85670	f18b90fd-04d3-4f06-8663-0f4860cb938d	d88b4df7-8f9d-4d1f-a0b9-9cdcdc4547c4	935971a5-fca6-4be4-90d3-3c7453a81a37	25	1	\N	\N	\N
692edd2c-82d7-4983-98d0-142634957bfc	f18b90fd-04d3-4f06-8663-0f4860cb938d	02a925e2-3ff1-4437-9247-8b3e2578a1fc	68fb09a3-d1fb-448e-84d6-3caf3d510c5a	25	2	\N	\N	\N
39d97837-a23a-4f03-a9df-f984cf7d86f0	f18b90fd-04d3-4f06-8663-0f4860cb938d	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
93111be3-f6c9-4683-b17b-8f183e897125	f18b90fd-04d3-4f06-8663-0f4860cb938d	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
c708dad6-d14e-4d3d-9f0f-e5f35845d8e3	f18b90fd-04d3-4f06-8663-0f4860cb938d	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
c56ebccb-7c04-4be0-892b-d387ee10a32f	3984e075-37a1-46ea-83de-e6472bb5afba	2d66d372-0eff-48e9-b2d3-7fb06e8d2318	fb0558e9-d20a-4690-aa19-e1458e0e16e9	30	1	\N	\N	\N
cbc9293e-33a9-4567-9983-4e50b8fdcf42	3984e075-37a1-46ea-83de-e6472bb5afba	a0bf5434-e043-457a-947b-243dfa09e887	38bf99d2-25c1-4474-a49a-478ff9823f8b	20	2	\N	\N	\N
29578068-31c0-46cd-bbcb-ef3962d84ac2	3984e075-37a1-46ea-83de-e6472bb5afba	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
4e8c57a0-fcb7-4f62-8aa7-7e86fdd2bb8c	3984e075-37a1-46ea-83de-e6472bb5afba	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
8a233f69-a8d4-4ce8-b234-c156a51afb09	3984e075-37a1-46ea-83de-e6472bb5afba	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
ce920df0-e814-4c40-9f3a-74a3c25168ab	4a2bcdfd-9430-47d9-af35-7675d281b9a1	44268082-05f5-49f9-9af3-61b8d059ce12	f2210e4f-e73a-438f-8be9-802b1391139a	25	1	\N	\N	\N
1849fab3-c59c-4a5f-9cb9-08d8b377e92a	4a2bcdfd-9430-47d9-af35-7675d281b9a1	b0a22927-954b-48eb-8128-bb0361e28746	f6e9720d-cd54-4ea6-9e02-b5eda62c4c9e	25	2	\N	\N	\N
998e0cda-a2c6-4a11-89c6-d64f8107a188	4a2bcdfd-9430-47d9-af35-7675d281b9a1	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
dba218bb-d770-4c2c-8a67-7b11872804e0	4a2bcdfd-9430-47d9-af35-7675d281b9a1	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
d76cf06c-6081-4c3a-83d4-9667493f7553	4a2bcdfd-9430-47d9-af35-7675d281b9a1	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
3c4a26cd-8954-43c9-944e-f616606f9e3d	62f2fbbf-f4d7-4b7c-973b-ed9018fb2d86	499b8c99-019e-4198-b4fe-fdfd69890634	9de1873b-84d4-48db-a4d4-3072d81ff184	20	1	\N	\N	\N
932cc5b9-59ff-40ce-abed-850f64c69c23	62f2fbbf-f4d7-4b7c-973b-ed9018fb2d86	c9929604-138b-4998-a7db-d644b21e0991	419debb5-df07-4520-bc8f-c2631bd482cc	30	2	\N	\N	\N
678e03ac-a03e-490f-a1ef-484c92f97f64	62f2fbbf-f4d7-4b7c-973b-ed9018fb2d86	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
7809d5e5-72f2-4c09-b59b-219c76dc6357	62f2fbbf-f4d7-4b7c-973b-ed9018fb2d86	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
eaca5b17-afb2-41eb-8f3d-13022265a90c	62f2fbbf-f4d7-4b7c-973b-ed9018fb2d86	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
d8dd1728-b0c2-42be-950e-9df1fa605f20	132aeb67-327c-46ad-bfef-3f320ca10af6	9a59cfbf-389e-43a5-9e78-17c315a759a6	47f4a82c-e268-4705-ab27-1e7cc756648a	20	1	\N	\N	\N
79f5e35c-b6e5-4200-a7dc-45ef58d8ff4b	132aeb67-327c-46ad-bfef-3f320ca10af6	c5e841f9-7320-413d-940b-65fa923f35d6	9e7c9b69-e705-49bc-ad0b-ad017fc0e07f	30	2	\N	\N	\N
ffde8938-aa66-47a3-9ce3-84a485072729	132aeb67-327c-46ad-bfef-3f320ca10af6	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
db002c91-11dd-4d9e-accd-51317f65c29c	132aeb67-327c-46ad-bfef-3f320ca10af6	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
9d30b0f5-a8de-459a-a0f3-ed3a8681feab	132aeb67-327c-46ad-bfef-3f320ca10af6	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
f942be77-897c-4d3d-9ca5-dc15206f3d4a	4d191243-b907-49e9-bff3-1278eed12654	59aba96f-85a4-432a-b9d2-3eee9d95a904	b9a8df16-fa32-4bdf-a438-9349bd440189	20	1	\N	\N	\N
a333eaab-e760-4fbf-8ab8-a38c523d37ef	4d191243-b907-49e9-bff3-1278eed12654	c5e841f9-7320-413d-940b-65fa923f35d6	9e7c9b69-e705-49bc-ad0b-ad017fc0e07f	30	2	\N	\N	\N
31308abc-470a-4ce7-bdf3-aaa3a5a1094a	4d191243-b907-49e9-bff3-1278eed12654	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
a2c674ff-e740-4794-baa0-82246f91011b	4d191243-b907-49e9-bff3-1278eed12654	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
c0d299d6-3392-4788-8dae-988083b96e51	4d191243-b907-49e9-bff3-1278eed12654	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
4b549576-00bd-4df7-b6d6-3f0e1331b52b	802b7fe8-00a0-4464-9115-859a604c0c5e	6d61d322-0c8a-4eca-b547-a082ff46fb01	55dc96b1-9585-44d1-94a9-f0eeaec7841d	20	1	\N	\N	\N
5ee43fc0-bcda-41e4-86f4-173e7a091987	802b7fe8-00a0-4464-9115-859a604c0c5e	c5e841f9-7320-413d-940b-65fa923f35d6	9e7c9b69-e705-49bc-ad0b-ad017fc0e07f	30	2	\N	\N	\N
969883c3-ec07-4f57-9630-1825e3f40f6f	802b7fe8-00a0-4464-9115-859a604c0c5e	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
022dfe50-9386-4bba-9e62-836265f8df1a	802b7fe8-00a0-4464-9115-859a604c0c5e	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
ae6f4ee7-bd5b-4d42-9374-0d880625171b	802b7fe8-00a0-4464-9115-859a604c0c5e	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
2839131c-babb-4166-95cb-f3ad9ebc2dd8	f0a158bc-a7a1-4328-a5c8-e56c9c50eb24	f78f6f58-11bc-473e-ba2f-5481174ef5d4	c76b96d6-f59f-4004-80fd-206af9f41ba3	20	1	\N	\N	\N
5da86d37-ffc8-43fb-898d-e75c3180ebf5	f0a158bc-a7a1-4328-a5c8-e56c9c50eb24	c5e841f9-7320-413d-940b-65fa923f35d6	9e7c9b69-e705-49bc-ad0b-ad017fc0e07f	30	2	\N	\N	\N
d2d6d2b1-074d-4731-bb21-3af5e5bba8f0	f0a158bc-a7a1-4328-a5c8-e56c9c50eb24	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
e0185f23-fbe4-49f3-8099-d0949262516a	f0a158bc-a7a1-4328-a5c8-e56c9c50eb24	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
e0fdbb1a-57d6-4f47-9d40-65fe82414b13	f0a158bc-a7a1-4328-a5c8-e56c9c50eb24	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
c727d81f-65fc-49c3-87fd-3f170d0faaaf	407561c8-53f6-475c-aa9e-fb831e36eaa7	8550a4cc-620a-4579-825e-fd24b3c60513	ad8cc4f8-c14c-4b22-b6d2-9563e718bdc7	20	1	\N	\N	\N
73f7d3f9-9fc9-4628-b5cb-3aefb7f5e102	407561c8-53f6-475c-aa9e-fb831e36eaa7	c5e841f9-7320-413d-940b-65fa923f35d6	d658b01f-715e-4030-b249-995e48ad6c20	30	2	\N	\N	\N
4acacc46-bec5-4240-93aa-a92ed3e1d8a7	407561c8-53f6-475c-aa9e-fb831e36eaa7	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
0244cf2d-6585-456c-aea3-d020847e13d4	407561c8-53f6-475c-aa9e-fb831e36eaa7	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
217477d4-725f-420c-999a-d32717156187	407561c8-53f6-475c-aa9e-fb831e36eaa7	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
0f21e3e6-f61c-4af6-8b1c-18e939f9a97b	67103d6d-93f7-4f77-a0d4-7ac02f4aad2e	ebe7ae0b-4e77-46fe-8330-0d9b786eef61	8c849898-b090-4f23-9b0d-72f0f8fa3ecc	20	1	\N	\N	\N
da434c86-0f94-4828-8999-6d46ff6c8077	67103d6d-93f7-4f77-a0d4-7ac02f4aad2e	c5e841f9-7320-413d-940b-65fa923f35d6	9e7c9b69-e705-49bc-ad0b-ad017fc0e07f	30	2	\N	\N	\N
66006c71-b2f4-42d6-b2ab-b7c573b6bb56	67103d6d-93f7-4f77-a0d4-7ac02f4aad2e	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
24d68c3b-584a-464c-aab8-96994c196bad	67103d6d-93f7-4f77-a0d4-7ac02f4aad2e	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
6683b96e-f90b-4dbc-bd2f-41b1460433e6	67103d6d-93f7-4f77-a0d4-7ac02f4aad2e	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
0c3d16c9-8bbb-404f-aa43-203ebea5b159	57b74620-52c7-45dc-9546-20093f33e508	499af1e2-7ecd-41b6-a64f-1334ad07fd89	583276c6-0b4e-4c2a-bd6a-ccd696fa4b1e	20	1	\N	\N	\N
a99aeee6-06b5-47a6-9475-86914282db32	57b74620-52c7-45dc-9546-20093f33e508	c5e841f9-7320-413d-940b-65fa923f35d6	9e7c9b69-e705-49bc-ad0b-ad017fc0e07f	30	2	\N	\N	\N
1d88e173-06df-4f36-9af1-4ac2e3f5f3c2	57b74620-52c7-45dc-9546-20093f33e508	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
4a0dc64e-b3ea-4104-9832-b97ceb554b6a	57b74620-52c7-45dc-9546-20093f33e508	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
24d7a471-8213-49fa-9066-18fbb3eceb62	57b74620-52c7-45dc-9546-20093f33e508	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
ba4c6ee8-323b-4371-8acf-105cadd0242c	279380e5-bd38-43e0-a856-a0a29e809691	499af1e2-7ecd-41b6-a64f-1334ad07fd89	99f8c126-db2a-43ba-8fa7-f66b797666a7	20	1	\N	\N	\N
66a7d3b6-216f-48ac-b8eb-c41b1264f2f9	279380e5-bd38-43e0-a856-a0a29e809691	c5e841f9-7320-413d-940b-65fa923f35d6	9e7c9b69-e705-49bc-ad0b-ad017fc0e07f	30	2	\N	\N	\N
7f17cb0f-60a8-421f-bd1d-cfc1cc6fc047	279380e5-bd38-43e0-a856-a0a29e809691	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
4dd553b9-d8a8-456f-9ef5-1ef7e1a84399	279380e5-bd38-43e0-a856-a0a29e809691	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
286e6a20-d539-44e9-ad5c-d8ddb2c7b773	279380e5-bd38-43e0-a856-a0a29e809691	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
60fb6062-3779-4b82-9956-2798dfdc18bf	adff5316-bf89-42bf-b47d-3c40591b00db	dc2c5e07-90c6-4179-be98-c89d66fe2b53	3676a4a5-5908-49e5-8246-4623711ab35c	10	1	\N	\N	\N
2d8a130a-6f4f-4706-b548-5a2e3cb57689	adff5316-bf89-42bf-b47d-3c40591b00db	cf044e19-6b14-4956-b3f4-82fa31927487	fbc09ac2-6e1b-45b9-b784-d5a9f24d9353	10	2	\N	\N	\N
ead198df-bed2-48ff-af7d-4f5793a9e4b6	adff5316-bf89-42bf-b47d-3c40591b00db	c5e841f9-7320-413d-940b-65fa923f35d6	9e7c9b69-e705-49bc-ad0b-ad017fc0e07f	30	3	\N	\N	\N
5d697b9e-ba53-48a0-aacd-f971320e23e0	adff5316-bf89-42bf-b47d-3c40591b00db	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	4	\N	\N	\N
e9c5f633-6d86-4d36-a95a-9f934fc271b6	adff5316-bf89-42bf-b47d-3c40591b00db	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	5	\N	\N	\N
59a1087d-ced9-4236-86be-47f2841722bc	adff5316-bf89-42bf-b47d-3c40591b00db	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	6	\N	\N	\N
19ce630c-7cb0-4fda-93a1-ac64e032bfcc	8f405f05-6374-4f30-af1c-aa44489d6130	13faee05-a8b0-4bf1-9d24-a894b570ff27	117dbbb2-b8d9-4c12-bfcf-584e696405d7	20	1	\N	\N	\N
defd0f51-d37c-4a7c-8c23-a1e364ae3cfa	8f405f05-6374-4f30-af1c-aa44489d6130	c5e841f9-7320-413d-940b-65fa923f35d6	9e7c9b69-e705-49bc-ad0b-ad017fc0e07f	30	2	\N	\N	\N
e4a9981b-8f1f-4c31-b29a-549920b7884f	8f405f05-6374-4f30-af1c-aa44489d6130	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
b51cdf79-6bbd-4a43-bcf0-4732edd0e70d	8f405f05-6374-4f30-af1c-aa44489d6130	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
d048a288-22cb-49d7-9084-0a11a62c5384	8f405f05-6374-4f30-af1c-aa44489d6130	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
6550528f-be84-4652-8d61-83f02a0d338a	794bd6f7-e206-44bf-8f32-650524703208	4dac7f69-686f-47b6-b3c5-6fdf053b97fc	cba0d6d6-d7f0-4046-bc7d-7603609c0f3a	25	1	\N	\N	\N
ee35eeab-22ab-45be-891d-7937b9832b90	794bd6f7-e206-44bf-8f32-650524703208	be29de82-88f2-4b81-af9d-75f78aef670b	153deb3b-53df-401d-a2dd-e073b89f8080	25	2	\N	\N	\N
f7dc2205-3e47-4283-aa31-fc8f333ad46b	794bd6f7-e206-44bf-8f32-650524703208	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
bba35ee9-478f-4b20-a0e2-225cdab3887e	794bd6f7-e206-44bf-8f32-650524703208	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
66964c0b-91f5-4c47-9219-e33197093e4a	794bd6f7-e206-44bf-8f32-650524703208	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
6c853024-6a6f-4847-88df-b80f6314b629	2a21767a-d382-4c95-821f-08f4b6201f38	008e6517-8106-462b-a54d-f68c9f92919d	67db4498-bd3d-46fd-bb5b-b878abf376b8	30	1	\N	\N	\N
be3340cc-a0a6-4db4-b25b-038cd2d3279a	2a21767a-d382-4c95-821f-08f4b6201f38	23186bd9-70e1-4461-b0f1-e6f7b0518584	270e7d90-e577-48dc-82ef-15bb6993409e	20	2	\N	\N	\N
a2bdc458-5c07-49bb-a987-9a5efdb47e30	2a21767a-d382-4c95-821f-08f4b6201f38	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
cef58d91-56ce-41c8-a36f-53afc52f6e52	2a21767a-d382-4c95-821f-08f4b6201f38	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
905b00d7-25aa-4112-b15a-0cc47cfae606	2a21767a-d382-4c95-821f-08f4b6201f38	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
f41b0942-00a9-4337-a244-91a839973a4c	51520a32-d43b-4b53-9a78-bdfc70be7029	054de95b-5f8e-4fd2-9021-0249fadd1774	c1cb23e6-d8fd-46db-8a48-4b0372d71236	30	1	\N	\N	\N
1a029956-2050-474e-8ec4-b74c45638bcb	51520a32-d43b-4b53-9a78-bdfc70be7029	29da3e50-0e13-4f30-8b21-6913c2d8bbdc	04d7c449-cc31-41ed-8032-89aca7cb52bd	20	2	\N	\N	\N
f99351b8-cbd6-4b95-908a-c447a1beccdd	51520a32-d43b-4b53-9a78-bdfc70be7029	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
2224c8be-f61c-4b24-9c98-e2ca78eb9e70	51520a32-d43b-4b53-9a78-bdfc70be7029	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
80f9ea89-3d9b-4b1c-9c89-8d324ae765ac	51520a32-d43b-4b53-9a78-bdfc70be7029	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
131b1102-07e9-4d77-a63a-649252c35d38	f21e4f42-e8eb-4c9c-a95c-701b53341008	5b22297d-439a-4b3e-a983-b8ae8c56182e	0c9747ce-d009-4800-8a92-4011862740dc	50	1	\N	\N	\N
569f47c0-6243-49d4-9944-4c2b2ed6926e	f21e4f42-e8eb-4c9c-a95c-701b53341008	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	2	\N	\N	\N
95afa20b-049e-49f9-9e04-d53a5158c370	f21e4f42-e8eb-4c9c-a95c-701b53341008	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	3	\N	\N	\N
3c47a48d-48ad-43d2-b6f5-b19188a33ffb	f21e4f42-e8eb-4c9c-a95c-701b53341008	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	4	\N	\N	\N
1914c029-8c75-4bc6-af02-6a10dd6692db	7c1951f6-60ad-4ae8-896e-3824a8674f0f	00a70b21-0ca0-4073-905b-ec50655fb4c5	b781a8aa-266d-4978-9436-b400ff362460	50	1	\N	\N	\N
0ed307a0-f48b-4dd6-8bd5-dfa71a22ec96	7c1951f6-60ad-4ae8-896e-3824a8674f0f	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	2	\N	\N	\N
281ff5ab-1411-4b80-93f6-a57143f13544	7c1951f6-60ad-4ae8-896e-3824a8674f0f	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	3	\N	\N	\N
82b4d810-0da1-4e66-a81a-07ddc8526481	7c1951f6-60ad-4ae8-896e-3824a8674f0f	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	4	\N	\N	\N
25843982-e5ed-4786-a8d0-75d3c7594299	4d97d22b-7a47-4513-b95e-9aaad96c6cab	00a70b21-0ca0-4073-905b-ec50655fb4c5	b781a8aa-266d-4978-9436-b400ff362460	50	1	\N	\N	\N
f1c1eea2-97a4-4047-8ada-a994e9ac617b	4d97d22b-7a47-4513-b95e-9aaad96c6cab	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	2	\N	\N	\N
2eec183e-818b-4223-9c41-9b5a2a839ebd	4d97d22b-7a47-4513-b95e-9aaad96c6cab	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	3	\N	\N	\N
ddcf9157-925b-45e1-a750-30aa28d5a0ea	4d97d22b-7a47-4513-b95e-9aaad96c6cab	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	4	\N	\N	\N
b784ca46-947b-4b20-9057-2df3d7308258	aa146f83-89e9-4169-8c15-5749101d21e0	ab98a411-75c8-46e8-acf5-4a9de148602c	06c90931-d0ca-42e3-8a71-90dd4a3ad342	25	1	\N	\N	\N
060ff9a4-ba05-4caa-8f78-9c7b22422a46	aa146f83-89e9-4169-8c15-5749101d21e0	9c0e74df-6264-4834-9ef6-3f71ebce7196	20f68dd6-e7d8-40f4-9287-2c65529fb0f2	25	2	\N	\N	\N
6f2a8e50-da94-40d9-ab25-8b258c94688c	aa146f83-89e9-4169-8c15-5749101d21e0	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
64b44098-605d-4a3e-ba17-1b0f24991c05	aa146f83-89e9-4169-8c15-5749101d21e0	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
06ef447d-5ebf-41cc-a5dc-9655c1cf19f9	aa146f83-89e9-4169-8c15-5749101d21e0	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
ca1a5643-8350-41da-bc14-f6ff715721ac	5e14108b-ce31-44f0-83d2-c61d43890573	4927f4a6-894b-4053-95cd-1f21a9afeb8c	057e00ab-c174-420b-94f2-842ed67aee00	50	1	\N	\N	\N
2498c739-3113-4855-b1bf-ac422b593031	5e14108b-ce31-44f0-83d2-c61d43890573	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	2	\N	\N	\N
9d120e57-67d5-4ac1-82cc-03371c3a0392	5e14108b-ce31-44f0-83d2-c61d43890573	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	3	\N	\N	\N
a95ec0e1-dfdf-4cd8-8a26-2b214ed58ff9	5e14108b-ce31-44f0-83d2-c61d43890573	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	4	\N	\N	\N
034cd30b-555d-4112-82a7-c95749c808f8	1d1825cf-4af4-460e-829f-a01b2e070373	00a70b21-0ca0-4073-905b-ec50655fb4c5	b781a8aa-266d-4978-9436-b400ff362460	50	1	\N	\N	\N
c027c5a7-1fe0-4fbb-bfee-51d43fa972b6	1d1825cf-4af4-460e-829f-a01b2e070373	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	2	\N	\N	\N
03f929f3-6795-4d56-b20d-dfa45d8bd419	1d1825cf-4af4-460e-829f-a01b2e070373	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	3	\N	\N	\N
fb0543fc-3717-4ec8-b0ef-c2b9e8bc0f92	1d1825cf-4af4-460e-829f-a01b2e070373	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	4	\N	\N	\N
0f5cec6a-3708-4f67-8286-351b773e6fce	73153b38-6365-484a-9172-1a4f52ae2095	ad2368f8-342e-4bbe-a2d2-92371c0dfb45	2dba60e5-8c49-4535-af85-3cb35c79fba5	25	1	\N	\N	\N
96d732a9-220f-4b6b-9353-e3abf7362355	73153b38-6365-484a-9172-1a4f52ae2095	6e2c6c81-831e-4587-b5dc-20fe02e20a8d	abee1d21-cfa6-49ca-b141-e07c006b45d4	25	2	\N	\N	\N
cd043958-e4fb-4946-8fa0-ef3baada04c6	73153b38-6365-484a-9172-1a4f52ae2095	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
6c30b095-c9cf-4dfb-85bb-967659f33a62	73153b38-6365-484a-9172-1a4f52ae2095	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
40f0188d-4fbc-4f1d-9dc0-e8694fac23b8	73153b38-6365-484a-9172-1a4f52ae2095	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
d28cbde4-b010-4638-a86c-1f6460444780	31ec7a83-2353-4f95-8e9c-29dfc2d8cc25	128e2024-c153-461d-b1bd-4309c5a0ed8b	a562abd0-27cb-4a36-a3c6-3193f0839977	25	1	\N	\N	\N
92f5f9b3-04d7-439b-b08e-ef0097d7f021	31ec7a83-2353-4f95-8e9c-29dfc2d8cc25	b0ef4a16-2947-49cb-bfb4-8c2aafc1b7fe	1a6779b1-2a56-4f41-9f46-a7fb26757f03	25	2	\N	\N	\N
c26555fd-53bf-458a-9934-82faf5d547a2	31ec7a83-2353-4f95-8e9c-29dfc2d8cc25	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
ee6e5fec-985a-4773-bb2b-c60637a412aa	31ec7a83-2353-4f95-8e9c-29dfc2d8cc25	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
75d7043e-887b-47f5-96d2-2d855c1c4191	31ec7a83-2353-4f95-8e9c-29dfc2d8cc25	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
6b5d4b98-289a-4ff6-988c-7ca9cbd9d5c1	a1f0fe83-c5e6-4875-bb58-d69bbead839a	be921cd5-fd9e-40ec-b9b4-8202af8b0cc5	53f34714-ae1a-4d8f-9973-a2eb26587b24	25	1	\N	\N	\N
3f769c81-7949-49f3-a371-390203c77871	a1f0fe83-c5e6-4875-bb58-d69bbead839a	0926b6a9-5d8c-4eab-9335-fd5ce60faf7b	0090ba2d-4e53-4e5e-948a-a038462f3a84	25	2	\N	\N	\N
deaba145-b999-4ea3-ba70-a9ce72c4badb	a1f0fe83-c5e6-4875-bb58-d69bbead839a	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
7eeb7d9e-48c5-4cb0-a952-1d8fc16cc817	a1f0fe83-c5e6-4875-bb58-d69bbead839a	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
b464fcc1-ef23-43ee-911a-eac93cf4b1e7	a1f0fe83-c5e6-4875-bb58-d69bbead839a	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
06cc7527-12f2-4bba-ab73-2b6591d7db3c	b0f74b5a-7c21-4a6c-8d53-40073e198636	8b786300-9853-437d-bb8b-8361466d6df4	74aea696-15eb-4252-acb1-38a503db34cc	50	1	\N	\N	\N
b7bdf4b6-5ae4-4852-bfe2-c59d35144e5d	b0f74b5a-7c21-4a6c-8d53-40073e198636	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	2	\N	\N	\N
9267a367-e9a1-4945-8a64-11b9b1daae7d	b0f74b5a-7c21-4a6c-8d53-40073e198636	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	3	\N	\N	\N
763ae38c-7334-42cd-aad3-27656e7c1b1b	b0f74b5a-7c21-4a6c-8d53-40073e198636	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	4	\N	\N	\N
7085c0ee-8807-4b1c-9379-39b43f8f3fff	746bb13f-7462-4c2c-8fed-c1281b3f0865	8791431f-82bd-477b-b4c9-a9b5211f8c50	18336036-712d-47d4-b22c-d3750e948b23	50	1	\N	\N	\N
8aadde46-d0e7-420d-bbf0-2b4192b4228a	746bb13f-7462-4c2c-8fed-c1281b3f0865	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	2	\N	\N	\N
8ff03d46-edf9-4cce-88a9-d2a2c052645f	746bb13f-7462-4c2c-8fed-c1281b3f0865	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	3	\N	\N	\N
9fbd2e33-79e7-41e4-b93d-c73515ae8a0e	746bb13f-7462-4c2c-8fed-c1281b3f0865	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	4	\N	\N	\N
aa65ac84-b91c-4bcc-954a-9c58044006b5	29a62b74-c7e6-4fb2-b8dd-9ec39cc5b3ff	8791431f-82bd-477b-b4c9-a9b5211f8c50	18336036-712d-47d4-b22c-d3750e948b23	50	1	\N	\N	\N
d7a80706-9651-4b19-8e6c-9f6e1372d10c	29a62b74-c7e6-4fb2-b8dd-9ec39cc5b3ff	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	2	\N	\N	\N
4c35f46e-4f2e-41a4-9570-2c9c993d9489	29a62b74-c7e6-4fb2-b8dd-9ec39cc5b3ff	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	3	\N	\N	\N
54dc47c5-bf35-46be-8a8c-bb97622dd96e	29a62b74-c7e6-4fb2-b8dd-9ec39cc5b3ff	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	4	\N	\N	\N
3abb2bf4-61d2-4e99-80b8-74a7eae1bdb1	f456ae3c-354c-4c34-9a08-81f7865c6a87	7faf144d-78ee-40f4-b9dc-aa5bb18a567a	6e8ead73-fbe1-4eed-ac92-89efe88d1150	25	1	\N	\N	\N
ec8d4c42-6280-4f78-89b5-78e4f4334ef0	f456ae3c-354c-4c34-9a08-81f7865c6a87	6a947471-7f6d-4951-b7fd-129e7e0824ad	92754a0b-98ad-4582-b23d-83144ecc2bcf	25	2	\N	\N	\N
10ed9ab0-65a6-4c6c-9e60-356e3d3a3f26	f456ae3c-354c-4c34-9a08-81f7865c6a87	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
e17c0cf6-89ba-4250-902f-69c436575fc0	f456ae3c-354c-4c34-9a08-81f7865c6a87	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
3a36c8a7-d9d0-487e-a784-4d7396256674	f456ae3c-354c-4c34-9a08-81f7865c6a87	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
5c9378f5-b015-46f1-9b65-8a067313b5ec	29772c20-a824-4b1f-ad17-387c9fc32ec5	1e1ca628-dae1-4efb-be74-d379c553eb75	0ce2acfd-cee5-49dc-b69e-3ddb9c2a665d	50	1	\N	\N	\N
95d49b9c-35d4-4c44-b9c6-700581921410	29772c20-a824-4b1f-ad17-387c9fc32ec5	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	2	\N	\N	\N
84b06a6c-3ba8-4f5e-b796-cb8d0d0d6310	29772c20-a824-4b1f-ad17-387c9fc32ec5	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	3	\N	\N	\N
ee56f2e2-88bd-4c15-85b7-4c20d9bd5eca	29772c20-a824-4b1f-ad17-387c9fc32ec5	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	4	\N	\N	\N
ff67ad8d-807c-4c09-a565-3759c3dce1fe	e143ecb6-f506-496a-971d-ff3872d307a9	b0e95aea-5cb3-4f25-85b8-f6f7b7394217	af09efff-a517-454f-8673-242c70398592	50	1	\N	\N	\N
356cce35-3782-4e1d-8618-3bd1bfe2a803	e143ecb6-f506-496a-971d-ff3872d307a9	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	2	\N	\N	\N
008f9fcf-a0fd-471e-8f59-6d95536f2c61	e143ecb6-f506-496a-971d-ff3872d307a9	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	3	\N	\N	\N
c950fac9-de3e-4cdb-8ce7-08c8dccff758	e143ecb6-f506-496a-971d-ff3872d307a9	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	4	\N	\N	\N
0c1d23ae-cbce-4e1c-82da-f790e1d63b23	d7c133cb-e56c-4aa5-ba62-0f4795a9c53e	b0e95aea-5cb3-4f25-85b8-f6f7b7394217	af09efff-a517-454f-8673-242c70398592	50	1	\N	\N	\N
00aee435-e981-4e51-9d28-9f194a773611	d7c133cb-e56c-4aa5-ba62-0f4795a9c53e	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	2	\N	\N	\N
91d9e9da-d13b-44cd-8fb0-453eec81af81	d7c133cb-e56c-4aa5-ba62-0f4795a9c53e	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	3	\N	\N	\N
3eec6a71-26e6-4252-8787-b0346e563af3	d7c133cb-e56c-4aa5-ba62-0f4795a9c53e	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	4	\N	\N	\N
2d960eb4-35c4-4084-8f76-78ee9e09e1e1	7714a712-4121-45ef-bab3-6b7fe66e3524	6d6660e4-7c55-45d7-a8bd-aad933855458	c3eaee66-6e83-4550-9692-e126f76b5554	20	1	\N	\N	\N
f173603a-4d5c-4f86-ae54-f38b5c49f651	7714a712-4121-45ef-bab3-6b7fe66e3524	d0d3c706-c94c-49f5-8d6b-ecfabd63f364	21d5ed08-eed0-4631-8400-1bb74e502787	15	2	\N	\N	\N
3eedc1cf-76cd-4eee-a57f-1b95d1ce5ad2	7714a712-4121-45ef-bab3-6b7fe66e3524	91aa04c3-0c94-4a65-aadc-4bfd36b3fc3f	8ade59bc-6d6e-4d88-9756-a12954112035	15	3	\N	\N	\N
a56ba65c-875d-4b10-a1c0-96ddc98f21b6	7714a712-4121-45ef-bab3-6b7fe66e3524	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	4	\N	\N	\N
38b40cf4-6ffd-4b7f-903d-251d0ddb4629	7714a712-4121-45ef-bab3-6b7fe66e3524	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	5	\N	\N	\N
f695d2eb-0015-423b-addf-a6bc125a9c9a	7714a712-4121-45ef-bab3-6b7fe66e3524	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	6	\N	\N	\N
8af0c736-b953-4e7a-b70c-9014443ce4f6	666f44c0-c95b-4c57-b494-eecf049278b1	16b1cc80-0b99-4f59-9b59-722b329fb952	131faa4a-7d60-47b4-bd1e-b253f9b1bf91	20	1	\N	\N	\N
4154c797-bb44-49ee-b384-3825eadbcab9	666f44c0-c95b-4c57-b494-eecf049278b1	baad0426-5c07-4980-9e79-a8ad93c4c7c7	9c15528b-b8ab-4420-8554-e3c50720bddf	30	2	\N	\N	\N
b044a4dc-431c-4ac9-b061-ed25af8fa5c9	666f44c0-c95b-4c57-b494-eecf049278b1	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
05ea6018-2bb3-4491-978a-89a266a4a702	666f44c0-c95b-4c57-b494-eecf049278b1	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
6df5f25e-d6cf-40f0-978e-0b1200434dc2	666f44c0-c95b-4c57-b494-eecf049278b1	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
77d6541b-d383-48dd-936a-caa690812404	38c6e5da-e6e0-4785-a819-ce23b794b315	8fe5e8a6-5a3d-4465-9e9d-64095c0affed	9b32cdad-aed6-4f3e-834f-c66d88d0ab7d	40	1	\N	\N	\N
7b4fda59-c615-4b72-b28a-f15dabd8fcb2	38c6e5da-e6e0-4785-a819-ce23b794b315	2398622c-298f-4841-ae81-5b54f660609b	66b5ad4c-3585-45e9-8daf-a2150609e38f	10	2	\N	\N	\N
3c6dfb37-b83d-464e-ad63-cb05c7616f46	38c6e5da-e6e0-4785-a819-ce23b794b315	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
c724db0f-9ed5-4756-b10f-76e9cd982e1c	38c6e5da-e6e0-4785-a819-ce23b794b315	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
0b96ccb5-56c8-4608-993a-9da3da4f12be	38c6e5da-e6e0-4785-a819-ce23b794b315	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
4682f56e-a539-4a38-ac17-5f44c7d6d297	95eb059b-6654-4e72-9dc3-30bd2ddb5bda	3e332410-3e15-4a8c-b3bd-74351e94ddd5	1b0eae8a-c070-4842-814c-b3f0e50f9902	20	1	\N	\N	\N
84a6b93f-761d-40ad-acac-007b6dd7f89d	95eb059b-6654-4e72-9dc3-30bd2ddb5bda	0296cbf2-b1f4-4d94-962e-6ba0d88a7d65	cf62cef5-fb17-4277-89eb-f54f66b2ebe4	15	2	\N	\N	\N
1d91f4d0-1d1b-4399-9ff8-25ff437cd9b5	95eb059b-6654-4e72-9dc3-30bd2ddb5bda	2101e201-9fe6-496e-ac66-ae6a895ce238	4c7853a0-3b7e-46e5-a70c-293b6b281c8f	15	3	\N	\N	\N
d9cc197c-41ef-4ce0-a333-3b9e5420d163	95eb059b-6654-4e72-9dc3-30bd2ddb5bda	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	4	\N	\N	\N
b94ceaf5-1901-46eb-8e2c-41972d6990dc	95eb059b-6654-4e72-9dc3-30bd2ddb5bda	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	5	\N	\N	\N
1c849d08-02a1-4dfc-ae77-e25fd8ced5dd	95eb059b-6654-4e72-9dc3-30bd2ddb5bda	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	6	\N	\N	\N
6994d629-5e4b-4c4a-a2d2-aaec39c1c5b0	324b947e-2fed-4814-89d0-314a8a9550d6	d0d3c706-c94c-49f5-8d6b-ecfabd63f364	2beb698f-f688-4d88-a342-cf44d0197877	50	1	\N	\N	\N
4d02baa9-a64d-4561-90df-5488efa18c97	324b947e-2fed-4814-89d0-314a8a9550d6	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	2	\N	\N	\N
c574fdbb-551b-4285-946d-95f0df7e2829	324b947e-2fed-4814-89d0-314a8a9550d6	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	3	\N	\N	\N
5b5e701e-5107-4649-9f13-337648321b53	324b947e-2fed-4814-89d0-314a8a9550d6	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	4	\N	\N	\N
f48f4d5d-49ce-4679-af96-47e69cd87cf7	957458a2-c6ab-4ec9-99dc-55429275e801	27d64c6e-2862-4ec5-b06c-8b05f0fdb60d	a1224f97-4dbd-4a1b-937d-fc3e1d2008e2	20	1	\N	\N	\N
2b2c4bfa-0b78-4cda-ac2f-22129ff1b8dd	957458a2-c6ab-4ec9-99dc-55429275e801	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	2	\N	\N	\N
6fc9cc82-ccba-42c9-8fbc-a24d7d951b88	957458a2-c6ab-4ec9-99dc-55429275e801	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	3	\N	\N	\N
b73f6393-05e9-433f-9630-741b592db3c3	957458a2-c6ab-4ec9-99dc-55429275e801	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	4	\N	\N	\N
ff3222e2-98ef-4c74-bd9f-6ab61b50673b	f270789a-8374-4404-be34-b4618fed23e9	6b629f4d-231a-497c-beb1-e997293af4a9	d719bd16-3a3a-4928-8ee0-7aecaba6114e	30	1	\N	\N	\N
ba5e38d1-d127-43a8-92d3-78d893a461af	f270789a-8374-4404-be34-b4618fed23e9	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	2	\N	\N	\N
c730d910-92b6-4ad3-be9d-4e4573614875	f270789a-8374-4404-be34-b4618fed23e9	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	3	\N	\N	\N
85adbec3-5ac8-44cb-b11f-665e08d3295e	f270789a-8374-4404-be34-b4618fed23e9	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	4	\N	\N	\N
af49a5d2-be71-4090-b088-906777b50050	0bcb29c2-5d3c-4475-9353-ddc42224967b	6d6660e4-7c55-45d7-a8bd-aad933855458	c9313072-c9ef-4e45-b36d-fbd2b7e58daf	30	1	\N	\N	\N
7e1aaa33-c1b0-48bb-a42e-9899cda0bc16	0bcb29c2-5d3c-4475-9353-ddc42224967b	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	2	\N	\N	\N
3253aa11-a966-46f6-934a-891aafc17d15	0bcb29c2-5d3c-4475-9353-ddc42224967b	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	3	\N	\N	\N
4ce390a0-dc02-43fa-9a89-40f0c2a99f6a	0bcb29c2-5d3c-4475-9353-ddc42224967b	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	4	\N	\N	\N
95c26006-ede5-4499-85b7-7197814e77fc	cdd24804-d5aa-4386-9988-951ad03e7815	6d6660e4-7c55-45d7-a8bd-aad933855458	c0000a7f-e7fb-4747-8ce9-ee1fec830806	20	1	\N	\N	\N
921dd594-2ea8-4e8b-98d1-6394d30b7426	cdd24804-d5aa-4386-9988-951ad03e7815	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	2	\N	\N	\N
84f81963-da71-4d10-9dee-5eefb7b6b0ef	cdd24804-d5aa-4386-9988-951ad03e7815	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	3	\N	\N	\N
0200c319-e95e-4715-bbc1-33ea4c67dcc2	cdd24804-d5aa-4386-9988-951ad03e7815	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	4	\N	\N	\N
1ad20277-5b0a-49b5-b977-9a5cd3be83e7	deba6627-8b9a-481a-9741-6c18e9ba0daf	6d6660e4-7c55-45d7-a8bd-aad933855458	41c651a8-58d3-4e75-ac6a-7fd7cb9d1b5b	50	1	\N	\N	\N
809fd0c7-7e58-4ab5-9e7e-efb10bdb3e1d	deba6627-8b9a-481a-9741-6c18e9ba0daf	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	2	\N	\N	\N
6bf8a20d-f2ed-4227-bd29-2c5b10eac27e	deba6627-8b9a-481a-9741-6c18e9ba0daf	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	3	\N	\N	\N
6d4bded5-c3a2-43de-828b-cebd78be69f1	deba6627-8b9a-481a-9741-6c18e9ba0daf	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	4	\N	\N	\N
64bb8955-351c-4c1b-a7e1-4762b15dd9d8	371a9c2b-32ad-4884-a615-472ac78781ef	448164ba-bf28-4abd-a60a-b26f37f734e7	0b53eead-f713-4206-8db1-b5a4bd91e99e	15	1	\N	\N	\N
4a3f86f1-8842-4cce-bc6a-57b2ff83ae2b	371a9c2b-32ad-4884-a615-472ac78781ef	d54161aa-f111-4109-9d7f-96f47d2f5e82	fba78c98-031d-41b7-8ee9-15bc242bd011	20	2	\N	\N	\N
78257722-a5f5-411e-ad39-2fa3f849d0e5	371a9c2b-32ad-4884-a615-472ac78781ef	3e332410-3e15-4a8c-b3bd-74351e94ddd5	a2c9ff2e-3f2d-49df-b4dc-48767023f168	15	3	\N	\N	\N
40e7fe72-a7be-4be2-a298-37962945fc85	371a9c2b-32ad-4884-a615-472ac78781ef	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	4	\N	\N	\N
46d15806-7a46-4f7c-8d35-17cd6400d755	371a9c2b-32ad-4884-a615-472ac78781ef	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	5	\N	\N	\N
4369631f-b0e4-4ad6-8729-a44bf701c7ae	371a9c2b-32ad-4884-a615-472ac78781ef	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	6	\N	\N	\N
d66c582e-887c-4730-95fe-fbff2279be12	3a4adc2b-3c60-47ef-b82e-3c9fa3b41507	3e332410-3e15-4a8c-b3bd-74351e94ddd5	647414bb-d823-4bc3-b591-69fa7c404b4a	20	1	\N	\N	\N
c0f42f8d-39c3-4df8-8e48-1163f0198cef	3a4adc2b-3c60-47ef-b82e-3c9fa3b41507	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	2	\N	\N	\N
6af8a891-7e68-4c4d-8794-404b925f53a3	3a4adc2b-3c60-47ef-b82e-3c9fa3b41507	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	3	\N	\N	\N
14f044ca-e446-4f2f-a98b-e1d42daf705c	3a4adc2b-3c60-47ef-b82e-3c9fa3b41507	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	4	\N	\N	\N
59b2ee89-6072-41e9-905f-971e3b53bcca	bdd1d057-3f62-43f6-9879-a7a9590a2cd7	3e332410-3e15-4a8c-b3bd-74351e94ddd5	9ef6c0d4-6e50-4a70-b00f-8f2ca0ede79f	15	1	\N	\N	\N
414fe98b-3bba-4472-a375-102fae4b3b04	bdd1d057-3f62-43f6-9879-a7a9590a2cd7	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	2	\N	\N	\N
fe3d155a-81a0-45d4-a40f-9d5764148b59	bdd1d057-3f62-43f6-9879-a7a9590a2cd7	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	3	\N	\N	\N
99bff105-be0a-480a-87e3-d06385b5c0b9	bdd1d057-3f62-43f6-9879-a7a9590a2cd7	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	4	\N	\N	\N
8f8d5437-9130-406f-81ce-22b3b38594e7	a3415994-1bf2-4287-9e0a-d9fbb997f03a	3e332410-3e15-4a8c-b3bd-74351e94ddd5	16dd2d36-9fa7-41f3-861d-9f7adefad2f3	20	1	\N	\N	\N
7373b26e-42e7-4e5c-a3a8-d438a9774f23	a3415994-1bf2-4287-9e0a-d9fbb997f03a	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	2	\N	\N	\N
3000eabe-2965-4eb5-996e-c4249a0f99a9	a3415994-1bf2-4287-9e0a-d9fbb997f03a	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	3	\N	\N	\N
e2390c91-3e94-4c7e-a803-9f82f91541e1	a3415994-1bf2-4287-9e0a-d9fbb997f03a	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	4	\N	\N	\N
76467067-04cd-43dd-a0f9-c8531d58a82b	0ae9f690-dfa0-4748-be7a-799e73c36f22	d1a3708c-b0d1-4907-be6e-166c17d21f8d	cce1e99f-d008-43dd-8f6c-386601b9b545	20	1	\N	\N	\N
cc305f86-9aac-4d78-9b81-2b82c429123f	0ae9f690-dfa0-4748-be7a-799e73c36f22	41a96d1c-812e-4022-9ccc-2f2c6197eff4	88c790b1-64a3-4c5b-bb03-646e7fd0e047	20	2	\N	\N	\N
17598d2f-07f0-424e-be85-1bfea4f12de5	0ae9f690-dfa0-4748-be7a-799e73c36f22	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	3	\N	\N	\N
78265fdb-794c-46df-8e5c-07d2442c5d48	0ae9f690-dfa0-4748-be7a-799e73c36f22	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	4	\N	\N	\N
7834375d-707b-4a46-b7d8-3a80affa1cc0	0ae9f690-dfa0-4748-be7a-799e73c36f22	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	5	\N	\N	\N
fee9b2ae-adc3-4047-9810-f1c30bb295a8	170ad47c-4108-43ea-9ae7-2f0ffd22af62	3e332410-3e15-4a8c-b3bd-74351e94ddd5	cfb6cd47-12b4-4659-ae45-1d6d9d1e8109	50	1	\N	\N	\N
2626606b-0604-4ce9-9412-94247d285aba	170ad47c-4108-43ea-9ae7-2f0ffd22af62	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	2	\N	\N	\N
3f20d94d-cedb-4a59-830e-6d90c90bbcb7	170ad47c-4108-43ea-9ae7-2f0ffd22af62	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	3	\N	\N	\N
a0cb836c-ac8a-4ee8-936b-76933f2d7abc	170ad47c-4108-43ea-9ae7-2f0ffd22af62	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	4	\N	\N	\N
fa502121-c400-4dfe-bbaa-743fba255a30	77a1e6bb-2c25-44c2-bb8e-b15fdf510b0b	3e332410-3e15-4a8c-b3bd-74351e94ddd5	d9d70610-54c6-4774-89e7-964f1fa7e1e2	30	1	\N	\N	\N
516cd6db-3176-4c10-8183-e115503a7c31	77a1e6bb-2c25-44c2-bb8e-b15fdf510b0b	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	2	\N	\N	\N
1688f0dc-f847-4ca1-b25b-95bfcababbd6	77a1e6bb-2c25-44c2-bb8e-b15fdf510b0b	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	3	\N	\N	\N
b32b9147-c443-4b88-9d35-ab535a774839	77a1e6bb-2c25-44c2-bb8e-b15fdf510b0b	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	4	\N	\N	\N
554d4604-f196-402c-9e73-6266ce89c985	8985c57e-f7b0-4dd0-90bd-4058b51ce939	28c849e4-11de-428e-b52e-76e971eb0f9a	f755c19a-7096-41df-bd60-2916ba1d193d	20	1	\N	\N	\N
590dd6b0-b80a-436b-8a0a-cb8f7bb2d5db	8985c57e-f7b0-4dd0-90bd-4058b51ce939	ffe35e0a-5b4e-4d34-a909-db60ef5807b0	7b7b7626-40c2-4883-a944-929eb1fa32bc	10	2	\N	\N	\N
6517d201-020d-4df5-b997-c51a94f64193	8985c57e-f7b0-4dd0-90bd-4058b51ce939	942809aa-3658-44af-b40a-9a51aa016a19	de658007-7683-4a51-b215-305137324975	10	3	\N	\N	\N
f35b0625-9fe9-4563-86ba-1f899213ee9e	8985c57e-f7b0-4dd0-90bd-4058b51ce939	3839026a-a2a0-4d02-8f14-f3ca188cd397	9e1d09ad-4c82-4e35-8b99-596f9394fcd4	10	4	\N	\N	\N
8228fe93-87f8-42c1-a08f-b56d6f3de86b	8985c57e-f7b0-4dd0-90bd-4058b51ce939	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	5	\N	\N	\N
232b8ba2-49c9-4397-9986-95b9b2a1660d	8985c57e-f7b0-4dd0-90bd-4058b51ce939	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	6	\N	\N	\N
338a3967-c9c1-4a29-b9ce-aa17fd88ca92	8985c57e-f7b0-4dd0-90bd-4058b51ce939	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	7	\N	\N	\N
d250fde3-ff35-4d78-92dd-bd2f5858a515	3bbb06bf-0a32-417b-a03d-66bcb73ba215	b4deb77d-6298-453e-94ee-eb5689129a4d	000ce80a-2938-4644-aeb9-f83afd465380	30	1	\N	\N	\N
ff92d3a7-bcef-4696-af01-4a53b5771c60	3bbb06bf-0a32-417b-a03d-66bcb73ba215	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	2	\N	\N	\N
962686a7-7bcb-4f02-bfc1-f560138fa8c8	3bbb06bf-0a32-417b-a03d-66bcb73ba215	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	3	\N	\N	\N
6eb45723-892c-4f1a-8c8a-aa74444bfad2	3bbb06bf-0a32-417b-a03d-66bcb73ba215	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	4	\N	\N	\N
cf12efd7-b060-404a-8722-e7a0d146ee40	2b4d5fb4-5a78-4aea-93b9-d7c4c73e9967	b4deb77d-6298-453e-94ee-eb5689129a4d	c29f3ac2-f872-429d-8770-29b964702983	30	1	\N	\N	\N
1d1aec60-4b2d-4ced-b00a-11a15b124303	2b4d5fb4-5a78-4aea-93b9-d7c4c73e9967	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	2	\N	\N	\N
3bb6d073-4f4a-47c0-817c-a8a3921fd723	2b4d5fb4-5a78-4aea-93b9-d7c4c73e9967	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	3	\N	\N	\N
5cd74436-717c-4415-9b2d-0799afa0be28	2b4d5fb4-5a78-4aea-93b9-d7c4c73e9967	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	4	\N	\N	\N
3daa658f-8b0b-4387-880b-8aeb6b74026e	249e35f2-d0df-4bee-a90c-13f7bcc5c6fd	28c849e4-11de-428e-b52e-76e971eb0f9a	490418f8-3a82-4685-bd0e-1e1982b605b9	20	1	\N	\N	\N
91a12554-0f65-4256-aa97-d940b50c7a97	249e35f2-d0df-4bee-a90c-13f7bcc5c6fd	4c262ac4-e331-48ba-a780-7992255ba83e	fb5efa2c-a18b-43a6-a6ef-715dc80657de	10	2	\N	\N	\N
de0f9a99-0f60-43e9-91b5-ca30b6c88d87	249e35f2-d0df-4bee-a90c-13f7bcc5c6fd	b94f3e05-f2be-405d-b1d6-1b0c1c1a92c0	1e49bc01-17f2-49e4-9275-f98a625a703e	10	3	\N	\N	\N
b6316c75-d853-4f94-93eb-c770b1ba36cf	249e35f2-d0df-4bee-a90c-13f7bcc5c6fd	3839026a-a2a0-4d02-8f14-f3ca188cd397	cbc4c7a2-0393-4cd4-bfd6-27542c8c79c8	10	4	\N	\N	\N
f04f4ecd-e29c-4860-b7de-996a81058b4a	249e35f2-d0df-4bee-a90c-13f7bcc5c6fd	67eebcb0-6142-41c9-8258-a1224cb5b912	ce40264e-3875-408a-88d3-3e73c38c6cde	30	5	\N	\N	\N
374c779c-b1eb-45ca-aa76-8604c215e5af	249e35f2-d0df-4bee-a90c-13f7bcc5c6fd	788f3eda-6413-46e4-8f26-13a248bc6ad3	1bf5bb4f-64e7-4e55-9897-a0d4c169b389	10	6	\N	\N	\N
dfc24d69-ba37-4a89-abd1-4797a44f720e	249e35f2-d0df-4bee-a90c-13f7bcc5c6fd	b797cd20-8301-43e0-a8f8-54a658537b1b	b031b426-2732-496a-aeda-d6192c900757	10	7	\N	\N	\N
\.


--
-- Data for Name: kpi_role_cards; Type: TABLE DATA; Schema: public; Owner: kpi_user
--

COPY public.kpi_role_cards (id, pos_id, role_id, role_name, version, status, valid_from, valid_to, created_by, approved_by, approved_at, created_at, updated_at, unit) FROM stdin;
a0e7d562-2805-4f7a-becd-cb99cd91707f	1	РУК_ПЕРЗ_001	Первый заместитель директора	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Руководство
004905af-db22-4aa1-98b2-3bc7b339306d	2	РУК_ЗАМД_002	Заместитель директора	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Руководство
86d28759-3cd0-4f7d-84f8-c65fe309e9a1	3	РУК_ЗАМД_003	Заместитель директора	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Руководство
8ff45751-83d5-48ec-8faa-ca8de13396b8	4	РУК_ЗАМД_004	Заместитель директора	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Руководство
40c66eba-ad98-4445-9538-725cabef18dd	5	ОРГ_НАЧ_005	Начальник управления	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление организационного обеспечения, бюджетного учета                      и финансовой отчетности
006779fa-af34-4c73-aff7-4a2ba6df035f	6	ОРГ_ЗАМ_006	Заместитель начальника управления	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление организационного обеспечения, бюджетного учета                      и финансовой отчетности
7c097b0b-8084-4fbc-986d-f81b4927f8a8	7	ОРГ_ЗАМ_НАЧ_ОТД_007	Заместитель начальника управления – начальник отдела	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление организационного обеспечения, бюджетного учета                                             и финансовой отчетности. Отдел финансово-экономической деятельности \nи государственных закупок
584b6634-3d14-4fea-8428-f3652c3bfe42	8	ОРГ_ЗАМ_ОТД_008	Заместитель начальника отдела	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление организационного обеспечения, бюджетного учета                      и финансовой отчетности. Отдел финансово- экономической деятельности                     и государственных закупок
d1e3b154-6347-46ee-91d1-63f4128c97a2	9	ОРГ_КОН_009	Консультант	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление организационного обеспечения, бюджетного учета            и финансовой отчетности. Отдел финансово- экономической деятельности                     и государственных закупок
f576e165-0a86-4160-bbeb-006d74f400f8	10	ОРГ_КОН_010	Консультант	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление организационного обеспечения, бюджетного учета                           и финансовой отчетности. Отдел финансово- экономической деятельности                                       и государственных закупок
9581bb61-2ef5-4fa9-9c13-ba16a7a42a11	11	ОРГ_ЗАМ_НАЧ_ОТД_011	Заместитель начальника управления – начальник отдела	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление организационного обеспечения, бюджетного учета                   и финансовой отчетности. Отдел организационного              и кадрового обеспечения
f8771d3d-fa0e-4b9d-948b-3ea36ee0a143	12	ОРГ_ЗАМ_ОТД_012	Заместитель начальника отдела	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление организационного обеспечения, бюджетного учета                   и финансовой отчетности. Отдел организационного              и кадрового обеспечения
7746dc41-71bd-4d16-80fc-878a562b5540	13	ОРГ_ГСП_013	Главный специалист	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление организационного обеспечения, бюджетного учета                                          и финансовой отчетности. Отдел организационного                и кадрового обеспечения
9a8f463a-ab55-44c0-9481-6e910d0344cf	14	ОРГ_КОН_014	Консультант	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление организационного обеспечения, бюджетного учета                                        и финансовой отчетности. Отдел организационного               и кадрового обеспечения
1573921f-1723-4801-bbd6-f3d0716ab476	15	ОРГ_КОН_015	Консультант	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление организационного обеспечения, бюджетного учета                                             и финансовой отчетности. Отдел организационного                и кадрового обеспечения
8395a568-671e-41bf-a567-ff3793a94d55	16	ОРГ_НАЧ_ОТД_016	Начальник отдела	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление организационного обеспечения, бюджетного учета                                             и финансовой отчетности. Отдел обеспечения взаимодействия с органами власти и местного самоуправления
6bc8d635-eb11-4375-896c-272eea81d9c9	17	ОРГ_ЗАМ_ОТД_017	Заместитель начальника отдела	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление организационного обеспечения, бюджетного учета                                             и финансовой отчетности. Отдел обеспечения взаимодействия с органами власти и местного самоуправления
0f8f4b37-1aa0-4232-acdc-f63f8d89ec1e	18	ОРГ_КОН_018	Консультант	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление организационного обеспечения, бюджетного учета                                             и финансовой отчетности. Отдел обеспечения взаимодействия с органами власти и местного самоуправления
9b2cc5b1-6606-44f3-9d3a-f99c027d50fa	19	ЕАС_НАЧ_019	Начальник управления	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление методологии развития ЕАСУЗ и технического обеспечения
484ac7d9-c0fb-4f08-9fb8-34888050702e	20	ЕАС_ЗАМ_020	Заместитель начальника управления	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление методологии развития ЕАСУЗ и технического обеспечения
894b3660-1c43-49f8-99ba-fc346c8addb6	21	ЕАС_ЗАМ_НАЧ_ОТД_021	Заместитель начальника управления – начальник отдела	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление методологии развития ЕАСУЗ и технического обеспечения. Отдел аналитики и постановки задач автоматизации                    информационных систем
2b26d243-0800-4d8b-b134-21f9ed05ce6c	22	ЕАС_ЗАМ_ОТД_022	Заместитель начальника отдела	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление методологии развития ЕАСУЗ и технического обеспечения. Отдел аналитики и постановки задач автоматизации                    информационных систем
6c45d625-3816-4321-943e-1281b6013cea	23	ЕАС_КОН_023	Консультант	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление методологии развития ЕАСУЗ и технического обеспечения. Отдел аналитики и постановки задач автоматизации                    информационных систем
d6dfd535-53e8-4fea-89b6-f63f95f37d4f	24	ЕАС_КОН_024	Консультант	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление методологии развития ЕАСУЗ и технического обеспечения. Отдел аналитики и постановки задач автоматизации                    информационных систем
2a838846-99b3-407c-8168-65cf3399922b	25	ЕАС_КОН_025	Консультант	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление методологии развития ЕАСУЗ и технического обеспечения. Отдел аналитики и постановки задач автоматизации                    информационных систем
f54d69f8-5cad-4e5e-9a0f-beee4e73bed9	26	ЕАС_КОН_026	Консультант	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление методологии развития ЕАСУЗ и технического обеспечения. Отдел аналитики и постановки задач автоматизации                    информационных систем
8d9aadcd-258b-457a-9e3b-06e78ceeec5e	27	ЕАС_НАЧ_ОТД_027	Начальник отдела	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление методологии развития ЕАСУЗ и технического обеспечения. Отдел технического обеспечения и информационной безопасности
0c566597-6438-4dfb-876f-138e07cd1d12	28	ЕАС_ЗАМ_ОТД_028	Заместитель начальника отдела	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление методологии развития ЕАСУЗ и технического обеспечения. Отдел технического обеспечения и информационной безопасности
ed0e02fd-e22d-41c6-828b-c1a32724518b	29	ЕАС_КОН_029	Консультант	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление методологии развития ЕАСУЗ и технического обеспечения. Отдел технического обеспечения и информационной безопасности
f7dc08fd-5867-4d75-a356-e28dcf3b7326	30	ЕАС_КОН_030	Консультант	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление методологии развития ЕАСУЗ и технического обеспечения. Отдел технического обеспечения и информационной безопасности
e6d892b1-5dc7-4a90-8c2d-677fc31459aa	31	ЕАС_ГСП_031	Главный специалист\n(1,5)	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление методологии развития ЕАСУЗ и технического обеспечения. Отдел технического обеспечения и информационной безопасности
2f89f89d-51ad-482c-b274-a5b22edfb8d7	32	ПРА_НАЧ_032	Начальник управления	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Правовое управление
5813e864-a45c-468c-8090-915ae6767c5a	33	ПРА_ЗАМ_033	Заместитель начальника управления	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Правовое управление
b2b625a4-280d-49f4-8fe4-9935f66c9ffc	34	ПРА_ЗАМ_НАЧ_ОТД_034	Заместитель начальника управления – начальник отдела	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Правовое управление.                Отдел судебной                             и административной практики
464d48f0-4372-4a54-9054-707b1be151b9	35	ПРА_ЗАМ_ОТД_035	Заместитель начальника отдела	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Правовое управление.                Отдел судебной                             и административной практики
4bede7fc-8fa9-45c4-a3a0-28764063bd02	36	ПРА_КОН_036	Консультант	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Правовое управление. Отдел судебной                          и административной практики
d22d4b6c-a012-4cf1-8f1a-ed1060bfef96	37	ПРА_КОН_037	Консультант\n(70%)	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Правовое управление. Отдел судебной                          и административной практики
f18b90fd-04d3-4f06-8663-0f4860cb938d	38	ПРА_ЗАМ_НАЧ_ОТД_038	Заместитель начальника управления – начальник отдела	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Правовое управление. Отдел нормативного                  и правового сопровождения
3984e075-37a1-46ea-83de-e6472bb5afba	39	ПРА_ЗАМ_ОТД_039	Заместитель начальника отдела	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Правовое управление. Отдел нормативного                  и правового сопровождения
4a2bcdfd-9430-47d9-af35-7675d281b9a1	40	ПРА_КОН_040	Консультант	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Правовое управление. Отдел нормативного                    и правового сопровождения
62f2fbbf-f4d7-4b7c-973b-ed9018fb2d86	41	ПРА_ГАН_041	Главный аналитик	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Правовое управление. Отдел нормативного                    и правового сопровождения
132aeb67-327c-46ad-bfef-3f320ca10af6	42	КЗА_НАЧ_042	Начальник управления	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление сопровождения корпоративных закупок
4d191243-b907-49e9-bff3-1278eed12654	43	КЗА_ЗАМ_043	Заместитель начальника управления	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление сопровождения корпоративных закупок
802b7fe8-00a0-4464-9115-859a604c0c5e	44	КЗА_ЗАМ_НАЧ_ОТД_044	Заместитель начальника управления – начальник отдела	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление сопровождения корпоративных закупок. Отдел мониторинга закупок
f0a158bc-a7a1-4328-a5c8-e56c9c50eb24	45	КЗА_ЗАМ_ОТД_045	Заместитель начальника отдела	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление сопровождения корпоративных закупок. Отдел мониторинга закупок
407561c8-53f6-475c-aa9e-fb831e36eaa7	46	КЗА_КОН_046	Консультант	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление сопровождения корпоративных закупок. Отдел мониторинга закупок
67103d6d-93f7-4f77-a0d4-7ac02f4aad2e	47	КЗА_ГАН_047	Главный аналитик	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление сопровождения корпоративных закупок. Отдел мониторинга закупок
57b74620-52c7-45dc-9546-20093f33e508	48	КЗА_ЗАМ_НАЧ_ОТД_048	Заместитель начальника управления – начальник отдела	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление сопровождения корпоративных закупок. Отдел взаимодействия               с заказчиками
279380e5-bd38-43e0-a856-a0a29e809691	49	КЗА_ЗАМ_ОТД_049	Заместитель начальника отдела	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление сопровождения корпоративных закупок. Отдел взаимодействия               с заказчиками
adff5316-bf89-42bf-b47d-3c40591b00db	50	КЗА_КОН_050	Консультант	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление сопровождения корпоративных закупок. Отдел взаимодействия              с заказчиками
8f405f05-6374-4f30-af1c-aa44489d6130	51	КЗА_ГСП_051	Главный специалист	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление сопровождения корпоративных закупок. Отдел взаимодействия                с заказчиками
794bd6f7-e206-44bf-8f32-650524703208	52	ЗПД_НАЧ_052	Начальник управления	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление подготовки земельно- имущественных торгов
2a21767a-d382-4c95-821f-08f4b6201f38	53	ЗПД_ЗАМ_053	Заместитель начальника управления	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление подготовки земельно- имущественных торгов
51520a32-d43b-4b53-9a78-bdfc70be7029	54	ЗПД_ЗАМ_НАЧ_ОТД_054	Заместитель начальника управления – начальник отдела	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление подготовки земельно- имущественных торгов. Отдел подготовки земельно- имущественных торгов
f21e4f42-e8eb-4c9c-a95c-701b53341008	55	ЗПД_ЗАМ_ОТД_055	Заместитель начальника отдела	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление подготовки земельно- имущественных торгов. Отдел подготовки земельно- имущественных торгов
7c1951f6-60ad-4ae8-896e-3824a8674f0f	56	ЗПД_КОН_056	Консультант	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление подготовки земельно- имущественных торгов. Отдел подготовки земельно- имущественных торгов
4d97d22b-7a47-4513-b95e-9aaad96c6cab	57	ЗПД_ГСП_057	Главный специалист	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление подготовки земельно- имущественных торгов. Отдел подготовки земельно-имущественных торгов
aa146f83-89e9-4169-8c15-5749101d21e0	58	ЗПД_ЗАМ_НАЧ_ОТД_058	Заместитель начальника управления – начальник отдела	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление подготовки земельно- имущественных торгов. Отдел межведомственного взаимодействия
5e14108b-ce31-44f0-83d2-c61d43890573	59	ЗПД_ЗАМ_ОТД_059	Заместитель начальника отдела	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление подготовки земельно- имущественных торгов. Отдел межведомственного взаимодействия
1d1825cf-4af4-460e-829f-a01b2e070373	60	ЗПД_КОН_060	Консультант	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление подготовки земельно- имущественных торгов. Отдел межведомственного взаимодействия
73153b38-6365-484a-9172-1a4f52ae2095	61	ЗПР_НАЧ_061	Начальник управления	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление проведения, мониторинга и аналитики земельно- имущественных торгов
31ec7a83-2353-4f95-8e9c-29dfc2d8cc25	62	ЗПР_ЗАМ_062	Заместитель начальника управления	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление проведения, мониторинга и аналитики земельно- имущественных торгов
a1f0fe83-c5e6-4875-bb58-d69bbead839a	63	ЗПР_ЗАМ_НАЧ_ОТД_063	Заместитель начальника управления – начальник отдела	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление проведения, мониторинга                    и аналитики земельно- имущественных торгов. Отдел мониторинга                   и аналитики земельно- имущественных торгов
b0f74b5a-7c21-4a6c-8d53-40073e198636	64	ЗПР_ЗАМ_ОТД_064	Заместитель начальника отдела	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление проведения, мониторинга                    и аналитики земельно- имущественных торгов. Отдел мониторинга                   и аналитики земельно- имущественных торгов
77a1e6bb-2c25-44c2-bb8e-b15fdf510b0b	87	ААД_КОН_087	Консультант\n(70%)	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление анализа и автоматизации данных. Отдел автоматизации и аналитики данных
746bb13f-7462-4c2c-8fed-c1281b3f0865	65	ЗПР_КОН_065	Консультант	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление проведения, мониторинга и аналитики земельно-имущественных торгов. Отдел мониторинга и аналитики земельно-имущественных торгов
29a62b74-c7e6-4fb2-b8dd-9ec39cc5b3ff	66	ЗПР_ГСП_066	Главный специалист	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление проведения, мониторинга и аналитики земельно-имущественных торгов. Отдел мониторинга и аналитики земельно-имущественных торгов
f456ae3c-354c-4c34-9a08-81f7865c6a87	67	ЗПР_ЗАМ_НАЧ_ОТД_067	Заместитель начальника управления – начальник отдела	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление проведения, мониторинга и аналитики земельно- имущественных торгов. Отдел проведения земельно- имущественных торгов
29772c20-a824-4b1f-ad17-387c9fc32ec5	68	ЗПР_ЗАМ_ОТД_068	Заместитель начальника отдела	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление проведения, мониторинга и аналитики земельно- имущественных торгов. Отдел проведения земельно- имущественных торгов
e143ecb6-f506-496a-971d-ff3872d307a9	69	ЗПР_КОН_069	Консультант	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление проведения, мониторинга и аналитики земельно- имущественных торгов. Отдел проведения земельно- имущественных торгов
d7c133cb-e56c-4aa5-ba62-0f4795a9c53e	70	ЗПР_ГСП_070	Главный специалист	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление проведения, мониторинга и аналитики земельно- имущественных торгов. Отдел проведения земельно- имущественных торгов
7714a712-4121-45ef-bab3-6b7fe66e3524	71	ЦТР_НАЧ_071	Начальник управления	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление цифровой трансформации и организации проектной деятельности
666f44c0-c95b-4c57-b494-eecf049278b1	72	ЦТР_ЗАМ_072	Заместитель начальника управления	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление цифровой трансформации и организации проектной деятельности
38c6e5da-e6e0-4785-a819-ce23b794b315	73	ЦТР_ЗАМ_НАЧ_ОТД_073	Заместитель начальника управления – начальник отдела	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление цифровой трансформации и организации проектной деятельности. Отдел цифровой трансформации
95eb059b-6654-4e72-9dc3-30bd2ddb5bda	74	ЦТР_ЗАМ_ОТД_074	Заместитель начальника отдела	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление цифровой трансформации и организации проектной деятельности. Отдел цифровой трансформации
324b947e-2fed-4814-89d0-314a8a9550d6	75	ЦТР_КОН_075	Консультант	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление цифровой трансформации и организации проектной деятельности. Отдел цифровой трансформации
957458a2-c6ab-4ec9-99dc-55429275e801	76	ЦТР_ГСП_076	Главный специалист	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление цифровой трансформации и организации проектной деятельности. Отдел цифровой трансформации
f270789a-8374-4404-be34-b4618fed23e9	77	ЦТР_ЗАМ_НАЧ_ОТД_077	Заместитель начальника управления – начальник отдела	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление цифровой трансформации и организации проектной деятельности. Отдел координации проектной деятельности
0bcb29c2-5d3c-4475-9353-ddc42224967b	78	ЦТР_ЗАМ_ОТД_078	Заместитель начальника отдела	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление цифровой трансформации и организации проектной деятельности. Отдел координации проектной деятельности
cdd24804-d5aa-4386-9988-951ad03e7815	79	ЦТР_КОН_079	Консультант	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление цифровой трансформации и организации проектной деятельности. Отдел координации проектной деятельности
deba6627-8b9a-481a-9741-6c18e9ba0daf	80	ЦТР_КОН_080	Консультант	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление цифровой трансформации и организации проектной деятельности. Отдел координации проектной деятельности
371a9c2b-32ad-4884-a615-472ac78781ef	81	ААД_НАЧ_081	Начальник управления	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление анализа и автоматизации данных
3a4adc2b-3c60-47ef-b82e-3c9fa3b41507	82	ААД_ЗАМ_082	Заместитель начальника управления	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление анализа и автоматизации данных
bdd1d057-3f62-43f6-9879-a7a9590a2cd7	83	ААД_ЗАМ_НАЧ_ОТД_083	Заместитель начальника управления – начальник отдела	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление анализа и автоматизации данных. Отдел автоматизации и аналитики данных
a3415994-1bf2-4287-9e0a-d9fbb997f03a	84	ААД_ЗАМ_ОТД_084	Заместитель начальника отдела	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление анализа и автоматизации данных. Отдел автоматизации и аналитики данных
0ae9f690-dfa0-4748-be7a-799e73c36f22	85	ААД_КОН_085	Консультант\n(95%)	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление анализа и автоматизации данных. Отдел автоматизации и аналитики данных
170ad47c-4108-43ea-9ae7-2f0ffd22af62	86	ААД_КОН_086	Консультант\n(90%)	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление анализа и автоматизации данных. Отдел автоматизации и аналитики данных
8985c57e-f7b0-4dd0-90bd-4058b51ce939	88	ААД_НАЧ_ОТД_088	Начальник отдела	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление анализа и автоматизации данных. Отдел анализа конкурентной среды
3bbb06bf-0a32-417b-a03d-66bcb73ba215	89	ААД_ЗАМ_ОТД_089	Заместитель начальника отдела	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление анализа и автоматизации данных. Отдел анализа конкурентной среды
2b4d5fb4-5a78-4aea-93b9-d7c4c73e9967	90	ААД_КОН_090	Консультант	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление анализа и автоматизации данных. Отдел анализа конкурентной среды
249e35f2-d0df-4bee-a90c-13f7bcc5c6fd	91	ААД_КОН_091	Консультант	1	active	2026-05-02	\N	import	\N	\N	2026-05-02 06:57:30.890995+00	2026-05-02 06:57:30.890995+00	Управление анализа и автоматизации данных. Отдел анализа конкурентной среды
21e65e14-4cac-4591-8f9d-75f230cf17c8	12	POS_12	тест	1	active	2026-05-04	\N	ZaichkoVV	\N	\N	2026-05-04 19:31:56.768079+00	2026-05-04 19:31:56.768079+00	Правовое управление
\.


--
-- Data for Name: kpi_submissions; Type: TABLE DATA; Schema: public; Owner: kpi_user
--

COPY public.kpi_submissions (id, employee_redmine_id, employee_login, period_id, period_name, position_id, redmine_issue_id, status, bin_discipline_summary, bin_schedule_summary, bin_safety_summary, kpi_values, ai_raw_summary, ai_generated_at, reviewer_redmine_id, reviewer_login, reviewer_comment, reviewed_at, submitted_at, created_at, updated_at, summary_text, summary_loaded_at) FROM stdin;
9f157cef-b5c1-4870-8645-706c9c71ae24	292	DaniushevskaiaSM	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	56	194801	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
8410d956-3a2f-47db-914b-06f7a4c94fbc	342	NuzhdovaZA	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	58	194802	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
8c0af3cc-bc29-4d68-99c4-6fe6ae8ec00c	373	ZaichkoVV	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	71	194396	submitted	\N	\N	\N	[{"indicator": "\\u041e\\u0431\\u0435\\u0441\\u043f\\u0435\\u0447\\u0435\\u043d\\u0438\\u0435 \\u043f\\u0440\\u043e\\u0435\\u043a\\u0442\\u043d\\u043e\\u0439 \\u0434\\u0435\\u044f\\u0442\\u0435\\u043b\\u044c\\u043d\\u043e\\u0441\\u0442\\u0438", "criterion": "\\u0421\\u043e\\u0441\\u0442\\u0430\\u0432\\u043b\\u0435\\u043d\\u0438\\u0435 \\u0434\\u0435\\u0442\\u0430\\u043b\\u044c\\u043d\\u044b\\u0445 \\u043f\\u043b\\u0430\\u043d\\u043e\\u0432 \\u0440\\u0435\\u0430\\u043b\\u0438\\u0437\\u0430\\u0446\\u0438\\u0438 \\u043f\\u0440\\u043e\\u0435\\u043a\\u0442\\u043e\\u0432 \\u0446\\u0438\\u0444\\u0440\\u043e\\u0432\\u043e\\u0439 \\u0442\\u0440\\u0430\\u043d\\u0441\\u0444\\u043e\\u0440\\u043c\\u0430\\u0446\\u0438\\u0438 \\u0438 \\u043e\\u0431\\u0435\\u0441\\u043f\\u0435\\u0447\\u0435\\u043d\\u0438\\u0435 \\u0438\\u0445 \\u0432\\u044b\\u043f\\u043e\\u043b\\u043d\\u0435\\u043d\\u0438\\u044f", "formula_type": "binary_auto", "weight": 20, "is_common": false, "cumulative": false, "kpi_type": "binary_auto", "score": 100, "confidence": 90, "summary": "\\u0421\\u043e\\u0442\\u0440\\u0443\\u0434\\u043d\\u0438\\u043a \\u043f\\u043e\\u0434\\u0433\\u043e\\u0442\\u043e\\u0432\\u0438\\u043b \\u0434\\u0435\\u0442\\u0430\\u043b\\u044c\\u043d\\u044b\\u0435 \\u043f\\u043b\\u0430\\u043d\\u044b \\u0438 \\u043f\\u0440\\u043e\\u0432\\u0451\\u043b \\u043a\\u043e\\u043e\\u0440\\u0434\\u0438\\u043d\\u0430\\u0446\\u0438\\u044e \\u043f\\u0440\\u043e\\u0435\\u043a\\u0442\\u043d\\u043e\\u0439 \\u0434\\u0435\\u044f\\u0442\\u0435\\u043b\\u044c\\u043d\\u043e\\u0441\\u0442\\u0438, \\u0447\\u0442\\u043e \\u0441\\u0432\\u0438\\u0434\\u0435\\u0442\\u0435\\u043b\\u044c\\u0441\\u0442\\u0432\\u0443\\u0435\\u0442 \\u043e \\u0432\\u044b\\u043f\\u043e\\u043b\\u043d\\u0435\\u043d\\u0438\\u0438 \\u043f\\u043e\\u043a\\u0430\\u0437\\u0430\\u0442\\u0435\\u043b\\u044f.", "awaiting_manual_input": false, "requires_fact_input": false, "fact_value": null, "parsed_thresholds": null, "requires_review": false, "ai_low_confidence": false}, {"indicator": "\\u041e\\u0431\\u0435\\u0441\\u043f\\u0435\\u0447\\u0435\\u043d\\u0438\\u0435 \\u043c\\u043e\\u0434\\u0435\\u043b\\u0438\\u0440\\u043e\\u0432\\u0430\\u043d\\u0438\\u044f \\u0431\\u0438\\u0437\\u043d\\u0435\\u0441-\\u043f\\u0440\\u043e\\u0446\\u0435\\u0441\\u0441\\u043e\\u0432", "criterion": "\\u041a\\u043e\\u043d\\u0442\\u0440\\u043e\\u043b\\u044c \\u0440\\u0435\\u0430\\u043b\\u0438\\u0437\\u0430\\u0446\\u0438\\u0438 \\u043c\\u043e\\u0434\\u0435\\u043b\\u0438\\u0440\\u043e\\u0432\\u0430\\u043d\\u0438\\u044f \\u0431\\u0438\\u0437\\u043d\\u0435\\u0441-\\u043f\\u0440\\u043e\\u0446\\u0435\\u0441\\u0441\\u043e\\u0432", "formula_type": "binary_auto", "weight": 15, "is_common": false, "cumulative": false, "kpi_type": "binary_auto", "score": 0, "confidence": 60, "summary": "\\u0412 \\u0441\\u0430\\u043c\\u043c\\u0430\\u0440\\u0438 \\u043d\\u0435 \\u0443\\u043a\\u0430\\u0437\\u0430\\u043d\\u043e, \\u0447\\u0442\\u043e \\u0431\\u044b\\u043b\\u0438 \\u043f\\u0440\\u043e\\u0432\\u0435\\u0434\\u0435\\u043d\\u044b \\u0440\\u0430\\u0431\\u043e\\u0442\\u044b \\u043f\\u043e \\u043c\\u043e\\u0434\\u0435\\u043b\\u0438\\u0440\\u043e\\u0432\\u0430\\u043d\\u0438\\u044e \\u0431\\u0438\\u0437\\u043d\\u0435\\u0441-\\u043f\\u0440\\u043e\\u0446\\u0435\\u0441\\u0441\\u043e\\u0432, \\u0445\\u043e\\u0442\\u044f \\u0431\\u044b\\u043b\\u0438 \\u043e\\u043f\\u0438\\u0441\\u0430\\u043d\\u044b \\u0434\\u0440\\u0443\\u0433\\u0438\\u0435 \\u0443\\u043f\\u0440\\u0430\\u0432\\u043b\\u0435\\u043d\\u0447\\u0435\\u0441\\u043a\\u0438\\u0435 \\u0438 \\u0442\\u0435\\u0445\\u043d\\u0438\\u0447\\u0435\\u0441\\u043a\\u0438\\u0435 \\u0437\\u0430\\u0434\\u0430\\u0447\\u0438.", "awaiting_manual_input": false, "requires_fact_input": false, "fact_value": null, "parsed_thresholds": null, "requires_review": false, "ai_low_confidence": false}, {"indicator": "\\u041f\\u0440\\u0435\\u0434\\u043e\\u0441\\u0442\\u0430\\u0432\\u043b\\u0435\\u043d\\u0438\\u0435 \\u043e\\u0442\\u0447\\u0435\\u0442\\u043d\\u043e\\u0439 \\u0434\\u043e\\u043a\\u0443\\u043c\\u0435\\u043d\\u0442\\u0430\\u0446\\u0438\\u0438 \\u043e \\u043f\\u0440\\u043e\\u0435\\u043a\\u0442\\u043d\\u043e\\u0439 \\u0434\\u0435\\u044f\\u0442\\u0435\\u043b\\u044c\\u043d\\u043e\\u0441\\u0442\\u0438", "criterion": "\\u0421\\u0431\\u043e\\u0440 \\u0438 \\u0441\\u0438\\u0441\\u0442\\u0435\\u043c\\u0430\\u0442\\u0438\\u0437\\u0430\\u0446\\u0438\\u044f \\u0434\\u0430\\u043d\\u043d\\u044b\\u0445 \\u043e \\u0445\\u043e\\u0434\\u0435 \\u043f\\u0440\\u043e\\u0435\\u043a\\u0442\\u043e\\u0432 \\u0446\\u0438\\u0444\\u0440\\u043e\\u0432\\u043e\\u0439 \\u0442\\u0440\\u0430\\u043d\\u0441\\u0444\\u043e\\u0440\\u043c\\u0430\\u0446\\u0438\\u0438, \\u043f\\u043e\\u0434\\u0433\\u043e\\u0442\\u043e\\u0432\\u043a\\u0430 \\u0440\\u0435\\u0433\\u0443\\u043b\\u044f\\u0440\\u043d\\u044b\\u0445 \\u043e\\u0442\\u0447\\u0435\\u0442\\u043e\\u0432 \\u0440\\u0443\\u043a\\u043e\\u0432\\u043e\\u0434\\u0441\\u0442\\u0432\\u0443", "formula_type": "binary_auto", "weight": 15, "is_common": false, "cumulative": false, "kpi_type": "binary_auto", "score": 100, "confidence": 100, "summary": "\\u0421\\u043e\\u0442\\u0440\\u0443\\u0434\\u043d\\u0438\\u043a \\u043f\\u043e\\u0434\\u0433\\u043e\\u0442\\u043e\\u0432\\u0438\\u043b \\u0430\\u043d\\u0430\\u043b\\u0438\\u0442\\u0438\\u0447\\u0435\\u0441\\u043a\\u0438\\u0435 \\u0434\\u0430\\u043d\\u043d\\u044b\\u0435 \\u0438 \\u043e\\u0442\\u0447\\u0451\\u0442\\u044b \\u043f\\u043e \\u043f\\u0440\\u043e\\u0435\\u043a\\u0442\\u043d\\u043e\\u0439 \\u0434\\u0435\\u044f\\u0442\\u0435\\u043b\\u044c\\u043d\\u043e\\u0441\\u0442\\u0438, \\u0440\\u0430\\u0437\\u0440\\u0430\\u0431\\u043e\\u0442\\u0430\\u043b \\u043c\\u043e\\u0434\\u0443\\u043b\\u044c \\u0444\\u043e\\u0440\\u043c\\u0438\\u0440\\u043e\\u0432\\u0430\\u043d\\u0438\\u044f \\u043e\\u0442\\u0447\\u0451\\u0442\\u043e\\u0432 \\u0438 \\u0432\\u044b\\u043f\\u043e\\u043b\\u043d\\u0438\\u043b \\u0437\\u0430\\u0433\\u0440\\u0443\\u0437\\u043a\\u0443 \\u0434\\u0430\\u043d\\u043d\\u044b\\u0445 \\u0432 \\u0431\\u0430\\u0437\\u0443, \\u0447\\u0442\\u043e \\u0441\\u043e\\u043e\\u0442\\u0432\\u0435\\u0442\\u0441\\u0442\\u0432\\u0443\\u0435\\u0442 \\u043a\\u0440\\u0438\\u0442\\u0435\\u0440\\u0438\\u044f\\u043c \\u043e\\u0446\\u0435\\u043d\\u043a\\u0438.", "awaiting_manual_input": false, "requires_fact_input": false, "fact_value": null, "parsed_thresholds": null, "requires_review": false, "ai_low_confidence": false}, {"indicator": "\\u041e\\u0431\\u0449\\u0438\\u0435 \\u043f\\u043e\\u043a\\u0430\\u0437\\u0430\\u0442\\u0435\\u043b\\u0438 \\u044d\\u0444\\u0444\\u0435\\u043a\\u0442\\u0438\\u0432\\u043d\\u043e\\u0441\\u0442\\u0438 \\u0438 \\u0440\\u0435\\u0437\\u0443\\u043b\\u044c\\u0442\\u0430\\u0442\\u0438\\u0432\\u043d\\u043e\\u0441\\u0442\\u0438 \\u0434\\u0435\\u044f\\u0442\\u0435\\u043b\\u044c\\u043d\\u043e\\u0441\\u0442\\u0438", "criterion": "\\u0421\\u043e\\u0431\\u043b\\u044e\\u0434\\u0435\\u043d\\u0438\\u0435 \\u0438\\u0441\\u043f\\u043e\\u043b\\u043d\\u0438\\u0442\\u0435\\u043b\\u044c\\u0441\\u043a\\u043e\\u0439 \\u0434\\u0438\\u0441\\u0446\\u0438\\u043f\\u043b\\u0438\\u043d\\u044b \\u043f\\u0440\\u0438 \\u0440\\u0430\\u0431\\u043e\\u0442\\u0435 \\u0432 \\u043c\\u0435\\u0436\\u0432\\u0435\\u0434\\u043e\\u043c\\u0441\\u0442\\u0432\\u0435\\u043d\\u043d\\u043e\\u0439 \\u0441\\u0438\\u0441\\u0442\\u0435\\u043c\\u0435 \\u044d\\u043b\\u0435\\u043a\\u0442\\u0440\\u043e\\u043d\\u043d\\u043e\\u0433\\u043e \\u0434\\u043e\\u043a\\u0443\\u043c\\u0435\\u043d\\u0442\\u043e\\u043e\\u0431\\u043e\\u0440\\u043e\\u0442\\u0430 \\u041c\\u043e\\u0441\\u043a\\u043e\\u0432\\u0441\\u043a\\u043e\\u0439 \\u043e\\u0431\\u043b\\u0430\\u0441\\u0442\\u0438 (\\u041c\\u0421\\u042d\\u0414, \\n\\u0417\\u041a \\u041c\\u0421\\u042d\\u0414), \\u0441\\u0440\\u043e\\u043a\\u043e\\u0432 \\u0438\\u0441\\u043f\\u043e\\u043b\\u043d\\u0435\\u043d\\u0438\\u044f \\u043f\\u0440\\u043e\\u0442\\u043e\\u043a\\u043e\\u043b\\u044c\\u043d\\u044b\\u0445 \\u043f\\u043e\\u0440\\u0443\\u0447\\u0435\\u043d\\u0438\\u0439, \\u043e\\u0431\\u0440\\u0430\\u0437\\u0443\\u044e\\u0449\\u0438\\u0445\\u0441\\u044f \\u0432 \\u0445\\u043e\\u0434\\u0435 \\u0434\\u0435\\u044f\\u0442\\u0435\\u043b\\u044c\\u043d\\u043e\\u0441\\u0442\\u0438 \\u0423\\u0447\\u0440\\u0435\\u0436\\u0434\\u0435\\u043d\\u0438\\u044f, \\u0441\\u0440\\u043e\\u043a\\u043e\\u0432 \\u0438\\u0441\\u043f\\u043e\\u043b\\u043d\\u0435\\u043d\\u0438\\u044f \\u043f\\u0440\\u0438\\u043a\\u0430\\u0437\\u043e\\u0432 \\u0438 \\u0440\\u0430\\u0441\\u043f\\u043e\\u0440\\u044f\\u0436\\u0435\\u043d\\u0438\\u0439 \\u0423\\u0447\\u0440\\u0435\\u0436\\u0434\\u0435\\u043d\\u0438\\u044f, \\u043f\\u0438\\u0441\\u044c\\u043c\\u0435\\u043d\\u043d\\u044b\\u0445 \\u0438 \\u0443\\u0441\\u0442\\u043d\\u044b\\u0445 \\u043f\\u043e\\u0440\\u0443\\u0447\\u0435\\u043d\\u0438\\u0439 \\u0440\\u0443\\u043a\\u043e\\u0432\\u043e\\u0434\\u0441\\u0442\\u0432\\u0430", "formula_type": "binary_manual", "weight": 30, "is_common": true, "cumulative": false, "kpi_type": "binary_manual", "score": null, "confidence": null, "summary": null, "awaiting_manual_input": true, "requires_fact_input": false, "fact_value": null, "parsed_thresholds": null, "requires_review": false, "ai_low_confidence": false, "common_text_positive": "\\u0418\\u0441\\u043f\\u043e\\u043b\\u043d\\u0438\\u0442\\u0435\\u043b\\u044c\\u0441\\u043a\\u0430\\u044f \\u0434\\u0438\\u0441\\u0446\\u0438\\u043f\\u043b\\u0438\\u043d\\u0430 \\u0441\\u043e\\u0431\\u043b\\u044e\\u0434\\u0430\\u0435\\u0442\\u0441\\u044f \\u0432 \\u043f\\u043e\\u043b\\u043d\\u043e\\u043c \\u043e\\u0431\\u044a\\u0451\\u043c\\u0435. \\u0421\\u0440\\u043e\\u043a\\u0438 \\u0438\\u0441\\u043f\\u043e\\u043b\\u043d\\u0435\\u043d\\u0438\\u044f \\u043f\\u0440\\u043e\\u0442\\u043e\\u043a\\u043e\\u043b\\u044c\\u043d\\u044b\\u0445 \\u043f\\u043e\\u0440\\u0443\\u0447\\u0435\\u043d\\u0438\\u0439, \\u043e\\u0431\\u0440\\u0430\\u0437\\u0443\\u044e\\u0449\\u0438\\u0445\\u0441\\u044f \\u0432 \\u0445\\u043e\\u0434\\u0435 \\u0434\\u0435\\u044f\\u0442\\u0435\\u043b\\u044c\\u043d\\u043e\\u0441\\u0442\\u0438 \\u0423\\u0447\\u0440\\u0435\\u0436\\u0434\\u0435\\u043d\\u0438\\u044f, \\u0430 \\u0442\\u0430\\u043a\\u0436\\u0435 \\u0441\\u0440\\u043e\\u043a\\u0438 \\u0438\\u0441\\u043f\\u043e\\u043b\\u043d\\u0435\\u043d\\u0438\\u044f \\u043f\\u0440\\u0438\\u043a\\u0430\\u0437\\u043e\\u0432 \\u0438 \\u0440\\u0430\\u0441\\u043f\\u043e\\u0440\\u044f\\u0436\\u0435\\u043d\\u0438\\u0439 \\u0423\\u0447\\u0440\\u0435\\u0436\\u0434\\u0435\\u043d\\u0438\\u044f, \\u043f\\u0438\\u0441\\u044c\\u043c\\u0435\\u043d\\u043d\\u044b\\u0445 \\u0438 \\u0443\\u0441\\u0442\\u043d\\u044b\\u0445 \\u043f\\u043e\\u0440\\u0443\\u0447\\u0435\\u043d\\u0438\\u0439 \\u0440\\u0443\\u043a\\u043e\\u0432\\u043e\\u0434\\u0441\\u0442\\u0432\\u0430 \\u043d\\u0435 \\u043d\\u0430\\u0440\\u0443\\u0448\\u0430\\u044e\\u0442\\u0441\\u044f.", "common_text_negative": "\\u0418\\u0441\\u043f\\u043e\\u043b\\u043d\\u0438\\u0442\\u0435\\u043b\\u044c\\u0441\\u043a\\u0430\\u044f \\u0434\\u0438\\u0441\\u0446\\u0438\\u043f\\u043b\\u0438\\u043d\\u0430 \\u043d\\u0435 \\u0441\\u043e\\u0431\\u043b\\u044e\\u0434\\u0430\\u0435\\u0442\\u0441\\u044f \\u0432 \\u043f\\u043e\\u043b\\u043d\\u043e\\u043c \\u043e\\u0431\\u044a\\u0451\\u043c\\u0435. \\u0414\\u043e\\u043f\\u0443\\u0449\\u0435\\u043d\\u044b \\u043d\\u0430\\u0440\\u0443\\u0448\\u0435\\u043d\\u0438\\u044f \\u0441\\u0440\\u043e\\u043a\\u043e\\u0432 \\u0438\\u0441\\u043f\\u043e\\u043b\\u043d\\u0435\\u043d\\u0438\\u044f \\u043f\\u0440\\u043e\\u0442\\u043e\\u043a\\u043e\\u043b\\u044c\\u043d\\u044b\\u0445 \\u043f\\u043e\\u0440\\u0443\\u0447\\u0435\\u043d\\u0438\\u0439, \\u043f\\u0440\\u0438\\u043a\\u0430\\u0437\\u043e\\u0432 \\u0438 \\u0440\\u0430\\u0441\\u043f\\u043e\\u0440\\u044f\\u0436\\u0435\\u043d\\u0438\\u0439 \\u0423\\u0447\\u0440\\u0435\\u0436\\u0434\\u0435\\u043d\\u0438\\u044f."}, {"indicator": "\\u041e\\u0431\\u0449\\u0438\\u0435 \\u043f\\u043e\\u043a\\u0430\\u0437\\u0430\\u0442\\u0435\\u043b\\u0438 \\u044d\\u0444\\u0444\\u0435\\u043a\\u0442\\u0438\\u0432\\u043d\\u043e\\u0441\\u0442\\u0438 \\u0438 \\u0440\\u0435\\u0437\\u0443\\u043b\\u044c\\u0442\\u0430\\u0442\\u0438\\u0432\\u043d\\u043e\\u0441\\u0442\\u0438 \\u0434\\u0435\\u044f\\u0442\\u0435\\u043b\\u044c\\u043d\\u043e\\u0441\\u0442\\u0438", "criterion": "\\u0421\\u043e\\u0431\\u043b\\u044e\\u0434\\u0435\\u043d\\u0438\\u0435 \\u041f\\u0440\\u0430\\u0432\\u0438\\u043b \\u0432\\u043d\\u0443\\u0442\\u0440\\u0435\\u043d\\u043d\\u0435\\u0433\\u043e \\u0442\\u0440\\u0443\\u0434\\u043e\\u0432\\u043e\\u0433\\u043e \\u0440\\u0430\\u0441\\u043f\\u043e\\u0440\\u044f\\u0434\\u043a\\u0430, \\u041a\\u043e\\u0434\\u0435\\u043a\\u0441\\u0430 \\u044d\\u0442\\u0438\\u043a\\u0438", "formula_type": "binary_manual", "weight": 10, "is_common": true, "cumulative": false, "kpi_type": "binary_manual", "score": null, "confidence": null, "summary": null, "awaiting_manual_input": true, "requires_fact_input": false, "fact_value": null, "parsed_thresholds": null, "requires_review": false, "ai_low_confidence": false, "common_text_positive": "\\u041f\\u0440\\u0430\\u0432\\u0438\\u043b\\u0430 \\u0432\\u043d\\u0443\\u0442\\u0440\\u0435\\u043d\\u043d\\u0435\\u0433\\u043e \\u0442\\u0440\\u0443\\u0434\\u043e\\u0432\\u043e\\u0433\\u043e \\u0440\\u0430\\u0441\\u043f\\u043e\\u0440\\u044f\\u0434\\u043a\\u0430 \\u0438 \\u041a\\u043e\\u0434\\u0435\\u043a\\u0441\\u0430 \\u044d\\u0442\\u0438\\u043a\\u0438 \\u0441\\u043e\\u0431\\u043b\\u044e\\u0434\\u0430\\u044e\\u0442\\u0441\\u044f \\u0432 \\u043f\\u043e\\u043b\\u043d\\u043e\\u043c \\u043e\\u0431\\u044a\\u0451\\u043c\\u0435.", "common_text_negative": "\\u041f\\u0440\\u0430\\u0432\\u0438\\u043b\\u0430 \\u0432\\u043d\\u0443\\u0442\\u0440\\u0435\\u043d\\u043d\\u0435\\u0433\\u043e \\u0442\\u0440\\u0443\\u0434\\u043e\\u0432\\u043e\\u0433\\u043e \\u0440\\u0430\\u0441\\u043f\\u043e\\u0440\\u044f\\u0434\\u043a\\u0430 \\u0438 \\u041a\\u043e\\u0434\\u0435\\u043a\\u0441\\u0430 \\u044d\\u0442\\u0438\\u043a\\u0438 \\u043d\\u0435 \\u0441\\u043e\\u0431\\u043b\\u044e\\u0434\\u0430\\u044e\\u0442\\u0441\\u044f \\u0432 \\u043f\\u043e\\u043b\\u043d\\u043e\\u043c \\u043e\\u0431\\u044a\\u0451\\u043c\\u0435."}, {"indicator": "\\u041e\\u0431\\u0449\\u0438\\u0435 \\u043f\\u043e\\u043a\\u0430\\u0437\\u0430\\u0442\\u0435\\u043b\\u0438 \\u044d\\u0444\\u0444\\u0435\\u043a\\u0442\\u0438\\u0432\\u043d\\u043e\\u0441\\u0442\\u0438 \\u0438 \\u0440\\u0435\\u0437\\u0443\\u043b\\u044c\\u0442\\u0430\\u0442\\u0438\\u0432\\u043d\\u043e\\u0441\\u0442\\u0438 \\u0434\\u0435\\u044f\\u0442\\u0435\\u043b\\u044c\\u043d\\u043e\\u0441\\u0442\\u0438", "criterion": "\\u0421\\u043e\\u0431\\u043b\\u044e\\u0434\\u0435\\u043d\\u0438\\u0435 \\u043f\\u0440\\u0430\\u0432\\u0438\\u043b \\u0438 \\u043d\\u043e\\u0440\\u043c \\u0442\\u0435\\u0445\\u043d\\u0438\\u043a\\u0438 \\u0431\\u0435\\u0437\\u043e\\u043f\\u0430\\u0441\\u043d\\u043e\\u0441\\u0442\\u0438, \\u043e\\u0445\\u0440\\u0430\\u043d\\u044b \\u0442\\u0440\\u0443\\u0434\\u0430 \\u0438 \\u043f\\u0440\\u043e\\u0442\\u0438\\u0432\\u043e\\u043f\\u043e\\u0436\\u0430\\u0440\\u043d\\u043e\\u0433\\u043e \\u0440\\u0435\\u0436\\u0438\\u043c\\u0430", "formula_type": "binary_manual", "weight": 10, "is_common": true, "cumulative": false, "kpi_type": "binary_manual", "score": null, "confidence": null, "summary": null, "awaiting_manual_input": true, "requires_fact_input": false, "fact_value": null, "parsed_thresholds": null, "requires_review": false, "ai_low_confidence": false, "common_text_positive": "\\u041f\\u0440\\u0430\\u0432\\u0438\\u043b\\u0430 \\u0438 \\u043d\\u043e\\u0440\\u043c\\u044b \\u0442\\u0435\\u0445\\u043d\\u0438\\u043a\\u0438 \\u0431\\u0435\\u0437\\u043e\\u043f\\u0430\\u0441\\u043d\\u043e\\u0441\\u0442\\u0438, \\u043e\\u0445\\u0440\\u0430\\u043d\\u044b \\u0442\\u0440\\u0443\\u0434\\u0430 \\u0438 \\u043f\\u0440\\u043e\\u0442\\u0438\\u0432\\u043e\\u043f\\u043e\\u0436\\u0430\\u0440\\u043d\\u043e\\u0433\\u043e \\u0440\\u0435\\u0436\\u0438\\u043c\\u0430 \\u0441\\u043e\\u0431\\u043b\\u044e\\u0434\\u0430\\u044e\\u0442\\u0441\\u044f \\u0432 \\u043f\\u043e\\u043b\\u043d\\u043e\\u043c \\u043e\\u0431\\u044a\\u0451\\u043c\\u0435.", "common_text_negative": "\\u041f\\u0440\\u0430\\u0432\\u0438\\u043b\\u0430 \\u0438 \\u043d\\u043e\\u0440\\u043c\\u044b \\u0442\\u0435\\u0445\\u043d\\u0438\\u043a\\u0438 \\u0431\\u0435\\u0437\\u043e\\u043f\\u0430\\u0441\\u043d\\u043e\\u0441\\u0442\\u0438, \\u043e\\u0445\\u0440\\u0430\\u043d\\u044b \\u0442\\u0440\\u0443\\u0434\\u0430 \\u0438 \\u043f\\u0440\\u043e\\u0442\\u0438\\u0432\\u043e\\u043f\\u043e\\u0436\\u0430\\u0440\\u043d\\u043e\\u0433\\u043e \\u0440\\u0435\\u0436\\u0438\\u043c\\u0430 \\u043d\\u0435 \\u0441\\u043e\\u0431\\u043b\\u044e\\u0434\\u0430\\u044e\\u0442\\u0441\\u044f \\u0432 \\u043f\\u043e\\u043b\\u043d\\u043e\\u043c \\u043e\\u0431\\u044a\\u0451\\u043c\\u0435."}]	\N	2026-04-30 05:40:41.571724+00	\N	\N	\N	\N	2026-04-30 05:40:41.571714+00	2026-04-28 10:09:04.491299+00	2026-04-30 05:40:38.550268+00	Проведены совещания по проектам трансформации и цифровой трансформации, включая встречи с кураторами и обсуждение статусов проектов. Подготовлены детальные планы и презентации по проектам внедрения ИИ. Выполнена координация проектной деятельности и автоматизация формирования отчётов в системе Redmine.\n\nПроведены совещания по проектам трансформации и внедрению ИИ. Подготовлены аналитические данные и презентации по проектной деятельности. Выполнена доработка системы Redmine для автоматизации формирования отчётов.\n\nПроведены совещания по проектам трансформации и цифровой трансформации, подготовлены аналитические данные и отчёты по проектной деятельности. Разработан модуль формирования отчётов в системе Redmine. Выполнена загрузка актуальных данных в базу данных и доработка структуры дашборда по проектам трансформации.	2026-04-30 05:40:11.977451+00
48627e17-44a2-4a2f-8059-a83521038dad	209	LuzhakovaTI	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	86	194803	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
4ef5a218-5789-44c4-b71f-139bf0000550	373	ZaichkoVV	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	4	194395	submitted	\N	\N	\N	[{"indicator": "\\u041e\\u0431\\u0435\\u0441\\u043f\\u0435\\u0447\\u0435\\u043d\\u0438\\u0435 \\u043f\\u0440\\u043e\\u0435\\u043a\\u0442\\u043d\\u043e\\u0439 \\u0434\\u0435\\u044f\\u0442\\u0435\\u043b\\u044c\\u043d\\u043e\\u0441\\u0442\\u0438", "criterion": "\\u041e\\u0431\\u0435\\u0441\\u043f\\u0435\\u0447\\u0435\\u043d\\u0438\\u0435 \\u0440\\u0435\\u0430\\u043b\\u0438\\u0437\\u0430\\u0446\\u0438\\u0438 \\u043f\\u0440\\u043e\\u0435\\u043a\\u0442\\u043e\\u0432 \\u0446\\u0438\\u0444\\u0440\\u043e\\u0432\\u043e\\u0439 \\u0442\\u0440\\u0430\\u043d\\u0441\\u0444\\u043e\\u0440\\u043c\\u0430\\u0446\\u0438\\u0438", "formula_type": "binary_auto", "weight": 20, "is_common": false, "cumulative": false, "kpi_type": "binary_auto", "score": 100, "confidence": 90, "summary": "\\u0421\\u043e\\u0442\\u0440\\u0443\\u0434\\u043d\\u0438\\u043a \\u0430\\u043a\\u0442\\u0438\\u0432\\u043d\\u043e \\u0443\\u0447\\u0430\\u0441\\u0442\\u0432\\u043e\\u0432\\u0430\\u043b \\u0432 \\u043f\\u0440\\u043e\\u0435\\u043a\\u0442\\u043d\\u043e\\u0439 \\u0434\\u0435\\u044f\\u0442\\u0435\\u043b\\u044c\\u043d\\u043e\\u0441\\u0442\\u0438, \\u0432\\u043a\\u043b\\u044e\\u0447\\u0430\\u044f \\u043f\\u043e\\u0434\\u0433\\u043e\\u0442\\u043e\\u0432\\u043a\\u0443 \\u0430\\u043d\\u0430\\u043b\\u0438\\u0442\\u0438\\u0447\\u0435\\u0441\\u043a\\u0438\\u0445 \\u0434\\u0430\\u043d\\u043d\\u044b\\u0445 \\u0438 \\u0434\\u043e\\u0440\\u043e\\u0436\\u043d\\u043e\\u0439 \\u043a\\u0430\\u0440\\u0442\\u044b \\u043f\\u043e \\u043f\\u0440\\u043e\\u0435\\u043a\\u0442\\u0430\\u043c \\u0432\\u043d\\u0435\\u0434\\u0440\\u0435\\u043d\\u0438\\u044f \\u0418\\u0418, \\u0447\\u0442\\u043e \\u0441\\u0432\\u0438\\u0434\\u0435\\u0442\\u0435\\u043b\\u044c\\u0441\\u0442\\u0432\\u0443\\u0435\\u0442 \\u043e\\u0431 \\u043e\\u0431\\u0435\\u0441\\u043f\\u0435\\u0447\\u0435\\u043d\\u0438\\u0438 \\u0440\\u0435\\u0430\\u043b\\u0438\\u0437\\u0430\\u0446\\u0438\\u0438 \\u043f\\u0440\\u043e\\u0435\\u043a\\u0442\\u043e\\u0432 \\u0446\\u0438\\u0444\\u0440\\u043e\\u0432\\u043e\\u0439 \\u0442\\u0440\\u0430\\u043d\\u0441\\u0444\\u043e\\u0440\\u043c\\u0430\\u0446\\u0438\\u0438.", "awaiting_manual_input": false, "requires_fact_input": false, "fact_value": null, "parsed_thresholds": null, "requires_review": false, "ai_low_confidence": false}, {"indicator": "\\u041e\\u0431\\u0435\\u0441\\u043f\\u0435\\u0447\\u0435\\u043d\\u0438\\u0435 \\u0431\\u0438\\u0437\\u043d\\u0435\\u0441-\\u0430\\u043d\\u0430\\u043b\\u0438\\u0437\\u0430", "criterion": "\\u0421\\u0438\\u0441\\u0442\\u0435\\u043c\\u0430\\u0442\\u0438\\u0437\\u0430\\u0446\\u0438\\u044f \\u0434\\u0435\\u0439\\u0441\\u0442\\u0432\\u0443\\u044e\\u0449\\u0435\\u0439 \\u0441\\u0442\\u0440\\u0443\\u043a\\u0442\\u0443\\u0440\\u044b \\u043f\\u0440\\u043e\\u0446\\u0435\\u0441\\u0441\\u043e\\u0432, \\u043f\\u0440\\u0438\\u043c\\u0435\\u043d\\u044f\\u0435\\u043c\\u044b\\u0445 \\u0442\\u0435\\u0445\\u043d\\u043e\\u043b\\u043e\\u0433\\u0438\\u0439 \\u0438 \\u0441\\u0432\\u044f\\u0437\\u0435\\u0439 \\u043c\\u0435\\u0436\\u0434\\u0443 \\u043d\\u0438\\u043c\\u0438", "formula_type": "binary_auto", "weight": 15, "is_common": false, "cumulative": false, "kpi_type": "binary_auto", "score": 100, "confidence": 90, "summary": "\\u0421\\u043e\\u0442\\u0440\\u0443\\u0434\\u043d\\u0438\\u043a \\u043f\\u0440\\u043e\\u0432\\u0451\\u043b \\u0441\\u0438\\u0441\\u0442\\u0435\\u043c\\u0430\\u0442\\u0438\\u0437\\u0430\\u0446\\u0438\\u044e \\u0434\\u0430\\u043d\\u043d\\u044b\\u0445 \\u0438 \\u043f\\u043e\\u0434\\u0433\\u043e\\u0442\\u043e\\u0432\\u0438\\u043b \\u043e\\u0442\\u0447\\u0451\\u0442\\u044b, \\u0447\\u0442\\u043e \\u0441\\u043e\\u043e\\u0442\\u0432\\u0435\\u0442\\u0441\\u0442\\u0432\\u0443\\u0435\\u0442 \\u043a\\u0440\\u0438\\u0442\\u0435\\u0440\\u0438\\u044e \\u043e\\u0446\\u0435\\u043d\\u043a\\u0438.", "awaiting_manual_input": false, "requires_fact_input": false, "fact_value": null, "parsed_thresholds": null, "requires_review": false, "ai_low_confidence": false}, {"indicator": "\\u041e\\u0431\\u0435\\u0441\\u043f\\u0435\\u0447\\u0435\\u043d\\u0438\\u0435 \\u0430\\u043d\\u0430\\u043b\\u0438\\u0442\\u0438\\u0447\\u0435\\u0441\\u043a\\u043e\\u0439 \\u0434\\u0435\\u044f\\u0442\\u0435\\u043b\\u044c\\u043d\\u043e\\u0441\\u0442\\u0438", "criterion": "\\u041e\\u0431\\u0435\\u0441\\u043f\\u0435\\u0447\\u0435\\u043d\\u0438\\u0435 \\u043f\\u0440\\u0435\\u0434\\u043e\\u0441\\u0442\\u0430\\u0432\\u043b\\u0435\\u043d\\u0438\\u044f \\u0430\\u043d\\u0430\\u043b\\u0438\\u0442\\u0438\\u0447\\u0435\\u0441\\u043a\\u043e\\u0439 \\u0438\\u043d\\u0444\\u043e\\u0440\\u043c\\u0430\\u0446\\u0438\\u0438 \\u0434\\u043b\\u044f \\u043f\\u0440\\u0438\\u043d\\u044f\\u0442\\u0438\\u044f \\u0443\\u043f\\u0440\\u0430\\u0432\\u043b\\u0435\\u043d\\u0447\\u0435\\u0441\\u043a\\u0438\\u0445 \\u0440\\u0435\\u0448\\u0435\\u043d\\u0438\\u0439", "formula_type": "binary_auto", "weight": 15, "is_common": false, "cumulative": false, "kpi_type": "binary_auto", "score": 100, "confidence": 90, "summary": "\\u0421\\u043e\\u0442\\u0440\\u0443\\u0434\\u043d\\u0438\\u043a \\u043f\\u043e\\u0434\\u0433\\u043e\\u0442\\u043e\\u0432\\u0438\\u043b \\u0430\\u043d\\u0430\\u043b\\u0438\\u0442\\u0438\\u0447\\u0435\\u0441\\u043a\\u0438\\u0435 \\u0434\\u0430\\u043d\\u043d\\u044b\\u0435 \\u0438 \\u043f\\u0440\\u0435\\u0437\\u0435\\u043d\\u0442\\u0430\\u0446\\u0438\\u0438, \\u0447\\u0442\\u043e \\u0441\\u043e\\u043e\\u0442\\u0432\\u0435\\u0442\\u0441\\u0442\\u0432\\u0443\\u0435\\u0442 \\u043a\\u0440\\u0438\\u0442\\u0435\\u0440\\u0438\\u044e \\u043e\\u0431\\u0435\\u0441\\u043f\\u0435\\u0447\\u0435\\u043d\\u0438\\u044f \\u043f\\u0440\\u0435\\u0434\\u043e\\u0441\\u0442\\u0430\\u0432\\u043b\\u0435\\u043d\\u0438\\u044f \\u0430\\u043d\\u0430\\u043b\\u0438\\u0442\\u0438\\u0447\\u0435\\u0441\\u043a\\u043e\\u0439 \\u0438\\u043d\\u0444\\u043e\\u0440\\u043c\\u0430\\u0446\\u0438\\u0438 \\u0434\\u043b\\u044f \\u043f\\u0440\\u0438\\u043d\\u044f\\u0442\\u0438\\u044f \\u0443\\u043f\\u0440\\u0430\\u0432\\u043b\\u0435\\u043d\\u0447\\u0435\\u0441\\u043a\\u0438\\u0445 \\u0440\\u0435\\u0448\\u0435\\u043d\\u0438\\u0439.", "awaiting_manual_input": false, "requires_fact_input": false, "fact_value": null, "parsed_thresholds": null, "requires_review": false, "ai_low_confidence": false}, {"indicator": "\\u041e\\u0431\\u0449\\u0438\\u0435 \\u043f\\u043e\\u043a\\u0430\\u0437\\u0430\\u0442\\u0435\\u043b\\u0438 \\u044d\\u0444\\u0444\\u0435\\u043a\\u0442\\u0438\\u0432\\u043d\\u043e\\u0441\\u0442\\u0438 \\u0438 \\u0440\\u0435\\u0437\\u0443\\u043b\\u044c\\u0442\\u0430\\u0442\\u0438\\u0432\\u043d\\u043e\\u0441\\u0442\\u0438 \\u0434\\u0435\\u044f\\u0442\\u0435\\u043b\\u044c\\u043d\\u043e\\u0441\\u0442\\u0438", "criterion": "\\u0421\\u043e\\u0431\\u043b\\u044e\\u0434\\u0435\\u043d\\u0438\\u0435 \\u0438\\u0441\\u043f\\u043e\\u043b\\u043d\\u0438\\u0442\\u0435\\u043b\\u044c\\u0441\\u043a\\u043e\\u0439 \\u0434\\u0438\\u0441\\u0446\\u0438\\u043f\\u043b\\u0438\\u043d\\u044b \\u043f\\u0440\\u0438 \\u0440\\u0430\\u0431\\u043e\\u0442\\u0435 \\u0432 \\u043c\\u0435\\u0436\\u0432\\u0435\\u0434\\u043e\\u043c\\u0441\\u0442\\u0432\\u0435\\u043d\\u043d\\u043e\\u0439 \\u0441\\u0438\\u0441\\u0442\\u0435\\u043c\\u0435 \\u044d\\u043b\\u0435\\u043a\\u0442\\u0440\\u043e\\u043d\\u043d\\u043e\\u0433\\u043e \\u0434\\u043e\\u043a\\u0443\\u043c\\u0435\\u043d\\u0442\\u043e\\u043e\\u0431\\u043e\\u0440\\u043e\\u0442\\u0430 \\u041c\\u043e\\u0441\\u043a\\u043e\\u0432\\u0441\\u043a\\u043e\\u0439 \\u043e\\u0431\\u043b\\u0430\\u0441\\u0442\\u0438 (\\u041c\\u0421\\u042d\\u0414, \\n\\u0417\\u041a \\u041c\\u0421\\u042d\\u0414), \\u0441\\u0440\\u043e\\u043a\\u043e\\u0432 \\u0438\\u0441\\u043f\\u043e\\u043b\\u043d\\u0435\\u043d\\u0438\\u044f \\u043f\\u0440\\u043e\\u0442\\u043e\\u043a\\u043e\\u043b\\u044c\\u043d\\u044b\\u0445 \\u043f\\u043e\\u0440\\u0443\\u0447\\u0435\\u043d\\u0438\\u0439, \\u043e\\u0431\\u0440\\u0430\\u0437\\u0443\\u044e\\u0449\\u0438\\u0445\\u0441\\u044f \\u0432 \\u0445\\u043e\\u0434\\u0435 \\u0434\\u0435\\u044f\\u0442\\u0435\\u043b\\u044c\\u043d\\u043e\\u0441\\u0442\\u0438 \\u0423\\u0447\\u0440\\u0435\\u0436\\u0434\\u0435\\u043d\\u0438\\u044f, \\u0441\\u0440\\u043e\\u043a\\u043e\\u0432 \\u0438\\u0441\\u043f\\u043e\\u043b\\u043d\\u0435\\u043d\\u0438\\u044f \\u043f\\u0440\\u0438\\u043a\\u0430\\u0437\\u043e\\u0432 \\u0438 \\u0440\\u0430\\u0441\\u043f\\u043e\\u0440\\u044f\\u0436\\u0435\\u043d\\u0438\\u0439 \\u0423\\u0447\\u0440\\u0435\\u0436\\u0434\\u0435\\u043d\\u0438\\u044f, \\u043f\\u0438\\u0441\\u044c\\u043c\\u0435\\u043d\\u043d\\u044b\\u0445 \\u0438 \\u0443\\u0441\\u0442\\u043d\\u044b\\u0445 \\u043f\\u043e\\u0440\\u0443\\u0447\\u0435\\u043d\\u0438\\u0439 \\u0440\\u0443\\u043a\\u043e\\u0432\\u043e\\u0434\\u0441\\u0442\\u0432\\u0430", "formula_type": "binary_manual", "weight": 30, "is_common": true, "cumulative": false, "kpi_type": "binary_manual", "score": null, "confidence": null, "summary": null, "awaiting_manual_input": true, "requires_fact_input": false, "fact_value": null, "parsed_thresholds": null, "requires_review": false, "ai_low_confidence": false, "common_text_positive": "\\u0418\\u0441\\u043f\\u043e\\u043b\\u043d\\u0438\\u0442\\u0435\\u043b\\u044c\\u0441\\u043a\\u0430\\u044f \\u0434\\u0438\\u0441\\u0446\\u0438\\u043f\\u043b\\u0438\\u043d\\u0430 \\u0441\\u043e\\u0431\\u043b\\u044e\\u0434\\u0430\\u0435\\u0442\\u0441\\u044f \\u0432 \\u043f\\u043e\\u043b\\u043d\\u043e\\u043c \\u043e\\u0431\\u044a\\u0451\\u043c\\u0435. \\u0421\\u0440\\u043e\\u043a\\u0438 \\u0438\\u0441\\u043f\\u043e\\u043b\\u043d\\u0435\\u043d\\u0438\\u044f \\u043f\\u0440\\u043e\\u0442\\u043e\\u043a\\u043e\\u043b\\u044c\\u043d\\u044b\\u0445 \\u043f\\u043e\\u0440\\u0443\\u0447\\u0435\\u043d\\u0438\\u0439, \\u043e\\u0431\\u0440\\u0430\\u0437\\u0443\\u044e\\u0449\\u0438\\u0445\\u0441\\u044f \\u0432 \\u0445\\u043e\\u0434\\u0435 \\u0434\\u0435\\u044f\\u0442\\u0435\\u043b\\u044c\\u043d\\u043e\\u0441\\u0442\\u0438 \\u0423\\u0447\\u0440\\u0435\\u0436\\u0434\\u0435\\u043d\\u0438\\u044f, \\u0430 \\u0442\\u0430\\u043a\\u0436\\u0435 \\u0441\\u0440\\u043e\\u043a\\u0438 \\u0438\\u0441\\u043f\\u043e\\u043b\\u043d\\u0435\\u043d\\u0438\\u044f \\u043f\\u0440\\u0438\\u043a\\u0430\\u0437\\u043e\\u0432 \\u0438 \\u0440\\u0430\\u0441\\u043f\\u043e\\u0440\\u044f\\u0436\\u0435\\u043d\\u0438\\u0439 \\u0423\\u0447\\u0440\\u0435\\u0436\\u0434\\u0435\\u043d\\u0438\\u044f, \\u043f\\u0438\\u0441\\u044c\\u043c\\u0435\\u043d\\u043d\\u044b\\u0445 \\u0438 \\u0443\\u0441\\u0442\\u043d\\u044b\\u0445 \\u043f\\u043e\\u0440\\u0443\\u0447\\u0435\\u043d\\u0438\\u0439 \\u0440\\u0443\\u043a\\u043e\\u0432\\u043e\\u0434\\u0441\\u0442\\u0432\\u0430 \\u043d\\u0435 \\u043d\\u0430\\u0440\\u0443\\u0448\\u0430\\u044e\\u0442\\u0441\\u044f.", "common_text_negative": "\\u0418\\u0441\\u043f\\u043e\\u043b\\u043d\\u0438\\u0442\\u0435\\u043b\\u044c\\u0441\\u043a\\u0430\\u044f \\u0434\\u0438\\u0441\\u0446\\u0438\\u043f\\u043b\\u0438\\u043d\\u0430 \\u043d\\u0435 \\u0441\\u043e\\u0431\\u043b\\u044e\\u0434\\u0430\\u0435\\u0442\\u0441\\u044f \\u0432 \\u043f\\u043e\\u043b\\u043d\\u043e\\u043c \\u043e\\u0431\\u044a\\u0451\\u043c\\u0435. \\u0414\\u043e\\u043f\\u0443\\u0449\\u0435\\u043d\\u044b \\u043d\\u0430\\u0440\\u0443\\u0448\\u0435\\u043d\\u0438\\u044f \\u0441\\u0440\\u043e\\u043a\\u043e\\u0432 \\u0438\\u0441\\u043f\\u043e\\u043b\\u043d\\u0435\\u043d\\u0438\\u044f \\u043f\\u0440\\u043e\\u0442\\u043e\\u043a\\u043e\\u043b\\u044c\\u043d\\u044b\\u0445 \\u043f\\u043e\\u0440\\u0443\\u0447\\u0435\\u043d\\u0438\\u0439, \\u043f\\u0440\\u0438\\u043a\\u0430\\u0437\\u043e\\u0432 \\u0438 \\u0440\\u0430\\u0441\\u043f\\u043e\\u0440\\u044f\\u0436\\u0435\\u043d\\u0438\\u0439 \\u0423\\u0447\\u0440\\u0435\\u0436\\u0434\\u0435\\u043d\\u0438\\u044f."}, {"indicator": "\\u041e\\u0431\\u0449\\u0438\\u0435 \\u043f\\u043e\\u043a\\u0430\\u0437\\u0430\\u0442\\u0435\\u043b\\u0438 \\u044d\\u0444\\u0444\\u0435\\u043a\\u0442\\u0438\\u0432\\u043d\\u043e\\u0441\\u0442\\u0438 \\u0438 \\u0440\\u0435\\u0437\\u0443\\u043b\\u044c\\u0442\\u0430\\u0442\\u0438\\u0432\\u043d\\u043e\\u0441\\u0442\\u0438 \\u0434\\u0435\\u044f\\u0442\\u0435\\u043b\\u044c\\u043d\\u043e\\u0441\\u0442\\u0438", "criterion": "\\u0421\\u043e\\u0431\\u043b\\u044e\\u0434\\u0435\\u043d\\u0438\\u0435 \\u041f\\u0440\\u0430\\u0432\\u0438\\u043b \\u0432\\u043d\\u0443\\u0442\\u0440\\u0435\\u043d\\u043d\\u0435\\u0433\\u043e \\u0442\\u0440\\u0443\\u0434\\u043e\\u0432\\u043e\\u0433\\u043e \\u0440\\u0430\\u0441\\u043f\\u043e\\u0440\\u044f\\u0434\\u043a\\u0430, \\u041a\\u043e\\u0434\\u0435\\u043a\\u0441\\u0430 \\u044d\\u0442\\u0438\\u043a\\u0438", "formula_type": "binary_manual", "weight": 10, "is_common": true, "cumulative": false, "kpi_type": "binary_manual", "score": null, "confidence": null, "summary": null, "awaiting_manual_input": true, "requires_fact_input": false, "fact_value": null, "parsed_thresholds": null, "requires_review": false, "ai_low_confidence": false, "common_text_positive": "\\u041f\\u0440\\u0430\\u0432\\u0438\\u043b\\u0430 \\u0432\\u043d\\u0443\\u0442\\u0440\\u0435\\u043d\\u043d\\u0435\\u0433\\u043e \\u0442\\u0440\\u0443\\u0434\\u043e\\u0432\\u043e\\u0433\\u043e \\u0440\\u0430\\u0441\\u043f\\u043e\\u0440\\u044f\\u0434\\u043a\\u0430 \\u0438 \\u041a\\u043e\\u0434\\u0435\\u043a\\u0441\\u0430 \\u044d\\u0442\\u0438\\u043a\\u0438 \\u0441\\u043e\\u0431\\u043b\\u044e\\u0434\\u0430\\u044e\\u0442\\u0441\\u044f \\u0432 \\u043f\\u043e\\u043b\\u043d\\u043e\\u043c \\u043e\\u0431\\u044a\\u0451\\u043c\\u0435.", "common_text_negative": "\\u041f\\u0440\\u0430\\u0432\\u0438\\u043b\\u0430 \\u0432\\u043d\\u0443\\u0442\\u0440\\u0435\\u043d\\u043d\\u0435\\u0433\\u043e \\u0442\\u0440\\u0443\\u0434\\u043e\\u0432\\u043e\\u0433\\u043e \\u0440\\u0430\\u0441\\u043f\\u043e\\u0440\\u044f\\u0434\\u043a\\u0430 \\u0438 \\u041a\\u043e\\u0434\\u0435\\u043a\\u0441\\u0430 \\u044d\\u0442\\u0438\\u043a\\u0438 \\u043d\\u0435 \\u0441\\u043e\\u0431\\u043b\\u044e\\u0434\\u0430\\u044e\\u0442\\u0441\\u044f \\u0432 \\u043f\\u043e\\u043b\\u043d\\u043e\\u043c \\u043e\\u0431\\u044a\\u0451\\u043c\\u0435."}, {"indicator": "\\u041e\\u0431\\u0449\\u0438\\u0435 \\u043f\\u043e\\u043a\\u0430\\u0437\\u0430\\u0442\\u0435\\u043b\\u0438 \\u044d\\u0444\\u0444\\u0435\\u043a\\u0442\\u0438\\u0432\\u043d\\u043e\\u0441\\u0442\\u0438 \\u0438 \\u0440\\u0435\\u0437\\u0443\\u043b\\u044c\\u0442\\u0430\\u0442\\u0438\\u0432\\u043d\\u043e\\u0441\\u0442\\u0438 \\u0434\\u0435\\u044f\\u0442\\u0435\\u043b\\u044c\\u043d\\u043e\\u0441\\u0442\\u0438", "criterion": "\\u0421\\u043e\\u0431\\u043b\\u044e\\u0434\\u0435\\u043d\\u0438\\u0435 \\u043f\\u0440\\u0430\\u0432\\u0438\\u043b \\u0438 \\u043d\\u043e\\u0440\\u043c \\u0442\\u0435\\u0445\\u043d\\u0438\\u043a\\u0438 \\u0431\\u0435\\u0437\\u043e\\u043f\\u0430\\u0441\\u043d\\u043e\\u0441\\u0442\\u0438, \\u043e\\u0445\\u0440\\u0430\\u043d\\u044b \\u0442\\u0440\\u0443\\u0434\\u0430 \\u0438 \\u043f\\u0440\\u043e\\u0442\\u0438\\u0432\\u043e\\u043f\\u043e\\u0436\\u0430\\u0440\\u043d\\u043e\\u0433\\u043e \\u0440\\u0435\\u0436\\u0438\\u043c\\u0430", "formula_type": "binary_manual", "weight": 10, "is_common": true, "cumulative": false, "kpi_type": "binary_manual", "score": null, "confidence": null, "summary": null, "awaiting_manual_input": true, "requires_fact_input": false, "fact_value": null, "parsed_thresholds": null, "requires_review": false, "ai_low_confidence": false, "common_text_positive": "\\u041f\\u0440\\u0430\\u0432\\u0438\\u043b\\u0430 \\u0438 \\u043d\\u043e\\u0440\\u043c\\u044b \\u0442\\u0435\\u0445\\u043d\\u0438\\u043a\\u0438 \\u0431\\u0435\\u0437\\u043e\\u043f\\u0430\\u0441\\u043d\\u043e\\u0441\\u0442\\u0438, \\u043e\\u0445\\u0440\\u0430\\u043d\\u044b \\u0442\\u0440\\u0443\\u0434\\u0430 \\u0438 \\u043f\\u0440\\u043e\\u0442\\u0438\\u0432\\u043e\\u043f\\u043e\\u0436\\u0430\\u0440\\u043d\\u043e\\u0433\\u043e \\u0440\\u0435\\u0436\\u0438\\u043c\\u0430 \\u0441\\u043e\\u0431\\u043b\\u044e\\u0434\\u0430\\u044e\\u0442\\u0441\\u044f \\u0432 \\u043f\\u043e\\u043b\\u043d\\u043e\\u043c \\u043e\\u0431\\u044a\\u0451\\u043c\\u0435.", "common_text_negative": "\\u041f\\u0440\\u0430\\u0432\\u0438\\u043b\\u0430 \\u0438 \\u043d\\u043e\\u0440\\u043c\\u044b \\u0442\\u0435\\u0445\\u043d\\u0438\\u043a\\u0438 \\u0431\\u0435\\u0437\\u043e\\u043f\\u0430\\u0441\\u043d\\u043e\\u0441\\u0442\\u0438, \\u043e\\u0445\\u0440\\u0430\\u043d\\u044b \\u0442\\u0440\\u0443\\u0434\\u0430 \\u0438 \\u043f\\u0440\\u043e\\u0442\\u0438\\u0432\\u043e\\u043f\\u043e\\u0436\\u0430\\u0440\\u043d\\u043e\\u0433\\u043e \\u0440\\u0435\\u0436\\u0438\\u043c\\u0430 \\u043d\\u0435 \\u0441\\u043e\\u0431\\u043b\\u044e\\u0434\\u0430\\u044e\\u0442\\u0441\\u044f \\u0432 \\u043f\\u043e\\u043b\\u043d\\u043e\\u043c \\u043e\\u0431\\u044a\\u0451\\u043c\\u0435."}]	\N	2026-04-30 05:29:34.362901+00	\N	\N	\N	\N	2026-04-30 05:29:34.362884+00	2026-04-28 10:09:04.491299+00	2026-04-30 05:29:31.019632+00	Проведены совещания по проектам трансформации и цифровой трансформации, включая встречи с кураторами и защиту проектов. Подготовлены аналитические данные, дорожная карта по проектам внедрения ИИ и отчёты по проектной деятельности. Выполнена автоматизация данных для формирования отчётов и доработка дашборда по проектам трансформации.\n\nПроведены мероприятия по координации проектной деятельности, включая подготовку аналитических данных и разработку модуля формирования отчётов. Подготовлены отчёты по проектам внедрения ИИ и цифровой трансформации. Выполнена систематизация данных для дашборда и загрузки в базу данных.\n\nПроведены совещания по различным проектам, включая проекты трансформации и внедрение ИИ. Подготовлены аналитические данные по проектной деятельности и презентации по итогам работы. Выполнена доработка Redmine для автоматизации формирования отчётов.	2026-04-30 05:25:55.747206+00
e442eb4a-3770-49f0-afa6-55e33bd3adaa	304	KostrovaIV	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	5	194804	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
8f03e91b-6d16-4801-94b7-1f51b1f154e2	373	ZaichkoVV	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	1	194393	submitted	\N	\N	\N	[{"indicator": "\\u041e\\u0431\\u0435\\u0441\\u043f\\u0435\\u0447\\u0435\\u043d\\u0438\\u0435 \\u043f\\u0440\\u0430\\u0432\\u043e\\u0432\\u043e\\u0433\\u043e \\u0441\\u043e\\u043f\\u0440\\u043e\\u0432\\u043e\\u0436\\u0434\\u0435\\u043d\\u0438\\u044f \\u0434\\u0435\\u044f\\u0442\\u0435\\u043b\\u044c\\u043d\\u043e\\u0441\\u0442\\u0438 \\u0423\\u0447\\u0440\\u0435\\u0436\\u0434\\u0435\\u043d\\u0438\\u044f", "criterion": "1. \\u041e\\u0442\\u0441\\u0443\\u0442\\u0441\\u0442\\u0432\\u0438\\u0435 \\u043f\\u0440\\u0438\\u0432\\u043b\\u0435\\u0447\\u0435\\u043d\\u0438\\u044f \\u0423\\u0447\\u0440\\u0435\\u0436\\u0434\\u0435\\u043d\\u0438\\u044f \\u043a \\u0430\\u0434\\u043c\\u0438\\u043d\\u0438\\u0441\\u0442\\u0440\\u0430\\u0442\\u0438\\u0432\\u043d\\u043e\\u0439 \\u043e\\u0442\\u0432\\u0435\\u0442\\u0441\\u0442\\u0432\\u0435\\u043d\\u043d\\u043e\\u0441\\u0442\\u0438\\n2. \\u041e\\u0442\\u0441\\u0443\\u0442\\u0441\\u0442\\u0432\\u0438\\u0435 \\u0443\\u0434\\u043e\\u0432\\u043b\\u0435\\u0442\\u0432\\u043e\\u0440\\u0435\\u043d\\u043d\\u044b\\u0445 \\u0438\\u0441\\u043a\\u043e\\u0432\\u044b\\u0445 \\u0442\\u0440\\u0435\\u0431\\u043e\\u0432\\u0430\\u043d\\u0438\\u0439, \\u043f\\u0440\\u0435\\u0434\\u0443\\u0441\\u043c\\u0430\\u0442\\u0440\\u0438\\u0432\\u0430\\u044e\\u0449\\u0438\\u0445 \\u0432\\u0437\\u044b\\u0441\\u043a\\u0430\\u043d\\u0438\\u0435 \\u0434\\u0435\\u043d\\u0435\\u0436\\u043d\\u044b\\u0445 \\u0441\\u0440\\u0435\\u0434\\u0441\\u0442\\u0432 \\u0441 \\u0423\\u0447\\u0440\\u0435\\u0436\\u0434\\u0435\\u043d\\u0438\\u044f", "formula_type": "binary_auto", "weight": 20, "is_common": false, "cumulative": false, "kpi_type": "binary_auto", "score": 100, "confidence": 80, "summary": "\\u041f\\u0435\\u0440\\u0432\\u044b\\u0439 \\u0437\\u0430\\u043c\\u0435\\u0441\\u0442\\u0438\\u0442\\u0435\\u043b\\u044c \\u0434\\u0438\\u0440\\u0435\\u043a\\u0442\\u043e\\u0440\\u0430 \\u043f\\u0440\\u043e\\u0432\\u0451\\u043b \\u0441\\u043e\\u0432\\u0435\\u0449\\u0430\\u043d\\u0438\\u044f \\u0438 \\u0432\\u0441\\u0442\\u0440\\u0435\\u0447\\u0438, \\u043f\\u043e\\u0434\\u0433\\u043e\\u0442\\u043e\\u0432\\u0438\\u043b \\u0430\\u043d\\u0430\\u043b\\u0438\\u0442\\u0438\\u0447\\u0435\\u0441\\u043a\\u0438\\u0435 \\u0434\\u0430\\u043d\\u043d\\u044b\\u0435 \\u0438 \\u043e\\u0442\\u0447\\u0451\\u0442\\u044b, \\u0430 \\u0442\\u0430\\u043a\\u0436\\u0435 \\u043a\\u043e\\u043e\\u0440\\u0434\\u0438\\u043d\\u0438\\u0440\\u043e\\u0432\\u0430\\u043b \\u043f\\u0440\\u043e\\u0435\\u043a\\u0442\\u043d\\u0443\\u044e \\u0434\\u0435\\u044f\\u0442\\u0435\\u043b\\u044c\\u043d\\u043e\\u0441\\u0442\\u044c, \\u0447\\u0442\\u043e \\u0441\\u043f\\u043e\\u0441\\u043e\\u0431\\u0441\\u0442\\u0432\\u043e\\u0432\\u0430\\u043b\\u043e \\u043c\\u0438\\u043d\\u0438\\u043c\\u0438\\u0437\\u0430\\u0446\\u0438\\u0438 \\u0440\\u0438\\u0441\\u043a\\u043e\\u0432 \\u043f\\u0440\\u0438\\u0432\\u043b\\u0435\\u0447\\u0435\\u043d\\u0438\\u044f \\u043a \\u0430\\u0434\\u043c\\u0438\\u043d\\u0438\\u0441\\u0442\\u0440\\u0430\\u0442\\u0438\\u0432\\u043d\\u043e\\u0439 \\u043e\\u0442\\u0432\\u0435\\u0442\\u0441\\u0442\\u0432\\u0435\\u043d\\u043d\\u043e\\u0441\\u0442\\u0438 \\u0438 \\u0432\\u0437\\u044b\\u0441\\u043a\\u0430\\u043d\\u0438\\u0439.", "awaiting_manual_input": false, "requires_fact_input": false, "fact_value": null, "parsed_thresholds": null, "requires_review": false, "ai_low_confidence": false}, {"indicator": "\\u041e\\u0431\\u0435\\u0441\\u043f\\u0435\\u0447\\u0435\\u043d\\u0438\\u0435 \\u0441\\u0432\\u043e\\u0435\\u0432\\u0440\\u0435\\u043c\\u0435\\u043d\\u043d\\u043e\\u0433\\u043e \\u0440\\u0430\\u0441\\u0441\\u043c\\u043e\\u0442\\u0440\\u0435\\u043d\\u0438\\u044f \\u043e\\u0431\\u0440\\u0430\\u0449\\u0435\\u043d\\u0438\\u0439 \\u0433\\u0440\\u0430\\u0436\\u0434\\u0430\\u043d \\u0432 \\u0441\\u043e\\u043e\\u0442\\u0432\\u0435\\u0442\\u0441\\u0442\\u0432\\u0438\\u0438 c \\u0424\\u0435\\u0434\\u0435\\u0440\\u0430\\u043b\\u044c\\u043d\\u044b\\u043c \\u0437\\u0430\\u043a\\u043e\\u043d\\u043e\\u043c \\u043e\\u0442 02.05.2006 \\u2116 59-\\u0424\\u0417 \\u00ab\\u041e \\u043f\\u043e\\u0440\\u044f\\u0434\\u043a\\u0435 \\u0440\\u0430\\u0441\\u0441\\u043c\\u043e\\u0442\\u0440\\u0435\\u043d\\u0438\\u044f \\u043e\\u0431\\u0440\\u0430\\u0449\\u0435\\u043d\\u0438\\u0439 \\u0433\\u0440\\u0430\\u0436\\u0434\\u0430\\u043d \\u0420\\u043e\\u0441\\u0441\\u0438\\u0439\\u0441\\u043a\\u043e\\u0439 \\u0424\\u0435\\u0434\\u0435\\u0440\\u0430\\u0446\\u0438\\u0438\\u00bb", "criterion": "\\u041e\\u0442\\u0441\\u0443\\u0442\\u0441\\u0442\\u0432\\u0438\\u0435 \\u043d\\u0430\\u0440\\u0443\\u0448\\u0435\\u043d\\u0438\\u0439 \\u043f\\u043e \\u0441\\u043e\\u0431\\u043b\\u044e\\u0434\\u0435\\u043d\\u0438\\u044e \\u0443\\u0441\\u0442\\u0430\\u043d\\u043e\\u0432\\u043b\\u0435\\u043d\\u043d\\u044b\\u0445 \\u0441\\u0440\\u043e\\u043a\\u043e\\u0432 \\u0438 \\u0442\\u0440\\u0435\\u0431\\u043e\\u0432\\u0430\\u043d\\u0438\\u0439 \\u043f\\u043e \\u0440\\u0430\\u0441\\u0441\\u043c\\u043e\\u0442\\u0440\\u0435\\u043d\\u0438\\u044e \\u043e\\u0431\\u0440\\u0430\\u0449\\u0435\\u043d\\u0438\\u0439 \\u0433\\u0440\\u0430\\u0436\\u0434\\u0430\\u043d", "formula_type": "binary_auto", "weight": 10, "is_common": false, "cumulative": false, "kpi_type": "binary_auto", "score": 0, "confidence": 100, "summary": "\\u0412 \\u0441\\u0430\\u043c\\u043c\\u0430\\u0440\\u0438 \\u043e\\u0442\\u0441\\u0443\\u0442\\u0441\\u0442\\u0432\\u0443\\u044e\\u0442 \\u0434\\u0430\\u043d\\u043d\\u044b\\u0435 \\u043e \\u0440\\u0430\\u0441\\u0441\\u043c\\u043e\\u0442\\u0440\\u0435\\u043d\\u0438\\u0438 \\u043e\\u0431\\u0440\\u0430\\u0449\\u0435\\u043d\\u0438\\u0439 \\u0433\\u0440\\u0430\\u0436\\u0434\\u0430\\u043d, \\u0447\\u0442\\u043e \\u0441\\u0432\\u0438\\u0434\\u0435\\u0442\\u0435\\u043b\\u044c\\u0441\\u0442\\u0432\\u0443\\u0435\\u0442 \\u043e \\u043d\\u0435\\u0432\\u044b\\u043f\\u043e\\u043b\\u043d\\u0435\\u043d\\u0438\\u0438 \\u043f\\u043e\\u043a\\u0430\\u0437\\u0430\\u0442\\u0435\\u043b\\u044f.", "awaiting_manual_input": false, "requires_fact_input": false, "fact_value": null, "parsed_thresholds": null, "requires_review": false, "ai_low_confidence": false}, {"indicator": "\\u041e\\u0431\\u0449\\u0438\\u0435 \\u043f\\u043e\\u043a\\u0430\\u0437\\u0430\\u0442\\u0435\\u043b\\u0438 \\u044d\\u0444\\u0444\\u0435\\u043a\\u0442\\u0438\\u0432\\u043d\\u043e\\u0441\\u0442\\u0438 \\u0438 \\u0440\\u0435\\u0437\\u0443\\u043b\\u044c\\u0442\\u0430\\u0442\\u0438\\u0432\\u043d\\u043e\\u0441\\u0442\\u0438 \\u0434\\u0435\\u044f\\u0442\\u0435\\u043b\\u044c\\u043d\\u043e\\u0441\\u0442\\u0438", "criterion": "\\u0421\\u043e\\u0431\\u043b\\u044e\\u0434\\u0435\\u043d\\u0438\\u0435 \\u0438\\u0441\\u043f\\u043e\\u043b\\u043d\\u0438\\u0442\\u0435\\u043b\\u044c\\u0441\\u043a\\u043e\\u0439 \\u0434\\u0438\\u0441\\u0446\\u0438\\u043f\\u043b\\u0438\\u043d\\u044b \\u043f\\u0440\\u0438 \\u0440\\u0430\\u0431\\u043e\\u0442\\u0435 \\u0432 \\u043c\\u0435\\u0436\\u0432\\u0435\\u0434\\u043e\\u043c\\u0441\\u0442\\u0432\\u0435\\u043d\\u043d\\u043e\\u0439 \\u0441\\u0438\\u0441\\u0442\\u0435\\u043c\\u0435 \\u044d\\u043b\\u0435\\u043a\\u0442\\u0440\\u043e\\u043d\\u043d\\u043e\\u0433\\u043e \\u0434\\u043e\\u043a\\u0443\\u043c\\u0435\\u043d\\u0442\\u043e\\u043e\\u0431\\u043e\\u0440\\u043e\\u0442\\u0430 \\u041c\\u043e\\u0441\\u043a\\u043e\\u0432\\u0441\\u043a\\u043e\\u0439 \\u043e\\u0431\\u043b\\u0430\\u0441\\u0442\\u0438 (\\u041c\\u0421\\u042d\\u0414, \\n\\u0417\\u041a \\u041c\\u0421\\u042d\\u0414), \\u0441\\u0440\\u043e\\u043a\\u043e\\u0432 \\u0438\\u0441\\u043f\\u043e\\u043b\\u043d\\u0435\\u043d\\u0438\\u044f \\u043f\\u0440\\u043e\\u0442\\u043e\\u043a\\u043e\\u043b\\u044c\\u043d\\u044b\\u0445 \\u043f\\u043e\\u0440\\u0443\\u0447\\u0435\\u043d\\u0438\\u0439, \\u043e\\u0431\\u0440\\u0430\\u0437\\u0443\\u044e\\u0449\\u0438\\u0445\\u0441\\u044f \\u0432 \\u0445\\u043e\\u0434\\u0435 \\u0434\\u0435\\u044f\\u0442\\u0435\\u043b\\u044c\\u043d\\u043e\\u0441\\u0442\\u0438 \\u0423\\u0447\\u0440\\u0435\\u0436\\u0434\\u0435\\u043d\\u0438\\u044f, \\u0441\\u0440\\u043e\\u043a\\u043e\\u0432 \\u0438\\u0441\\u043f\\u043e\\u043b\\u043d\\u0435\\u043d\\u0438\\u044f \\u043f\\u0440\\u0438\\u043a\\u0430\\u0437\\u043e\\u0432 \\u0438 \\u0440\\u0430\\u0441\\u043f\\u043e\\u0440\\u044f\\u0436\\u0435\\u043d\\u0438\\u0439 \\u0423\\u0447\\u0440\\u0435\\u0436\\u0434\\u0435\\u043d\\u0438\\u044f, \\u043f\\u0438\\u0441\\u044c\\u043c\\u0435\\u043d\\u043d\\u044b\\u0445 \\u0438 \\u0443\\u0441\\u0442\\u043d\\u044b\\u0445 \\u043f\\u043e\\u0440\\u0443\\u0447\\u0435\\u043d\\u0438\\u0439 \\u0440\\u0443\\u043a\\u043e\\u0432\\u043e\\u0434\\u0441\\u0442\\u0432\\u0430", "formula_type": "binary_manual", "weight": 30, "is_common": true, "cumulative": false, "kpi_type": "binary_manual", "score": null, "confidence": null, "summary": null, "awaiting_manual_input": true, "requires_fact_input": false, "fact_value": null, "parsed_thresholds": null, "requires_review": false, "ai_low_confidence": false, "common_text_positive": "\\u0418\\u0441\\u043f\\u043e\\u043b\\u043d\\u0438\\u0442\\u0435\\u043b\\u044c\\u0441\\u043a\\u0430\\u044f \\u0434\\u0438\\u0441\\u0446\\u0438\\u043f\\u043b\\u0438\\u043d\\u0430 \\u0441\\u043e\\u0431\\u043b\\u044e\\u0434\\u0430\\u0435\\u0442\\u0441\\u044f \\u0432 \\u043f\\u043e\\u043b\\u043d\\u043e\\u043c \\u043e\\u0431\\u044a\\u0451\\u043c\\u0435. \\u0421\\u0440\\u043e\\u043a\\u0438 \\u0438\\u0441\\u043f\\u043e\\u043b\\u043d\\u0435\\u043d\\u0438\\u044f \\u043f\\u0440\\u043e\\u0442\\u043e\\u043a\\u043e\\u043b\\u044c\\u043d\\u044b\\u0445 \\u043f\\u043e\\u0440\\u0443\\u0447\\u0435\\u043d\\u0438\\u0439, \\u043e\\u0431\\u0440\\u0430\\u0437\\u0443\\u044e\\u0449\\u0438\\u0445\\u0441\\u044f \\u0432 \\u0445\\u043e\\u0434\\u0435 \\u0434\\u0435\\u044f\\u0442\\u0435\\u043b\\u044c\\u043d\\u043e\\u0441\\u0442\\u0438 \\u0423\\u0447\\u0440\\u0435\\u0436\\u0434\\u0435\\u043d\\u0438\\u044f, \\u0430 \\u0442\\u0430\\u043a\\u0436\\u0435 \\u0441\\u0440\\u043e\\u043a\\u0438 \\u0438\\u0441\\u043f\\u043e\\u043b\\u043d\\u0435\\u043d\\u0438\\u044f \\u043f\\u0440\\u0438\\u043a\\u0430\\u0437\\u043e\\u0432 \\u0438 \\u0440\\u0430\\u0441\\u043f\\u043e\\u0440\\u044f\\u0436\\u0435\\u043d\\u0438\\u0439 \\u0423\\u0447\\u0440\\u0435\\u0436\\u0434\\u0435\\u043d\\u0438\\u044f, \\u043f\\u0438\\u0441\\u044c\\u043c\\u0435\\u043d\\u043d\\u044b\\u0445 \\u0438 \\u0443\\u0441\\u0442\\u043d\\u044b\\u0445 \\u043f\\u043e\\u0440\\u0443\\u0447\\u0435\\u043d\\u0438\\u0439 \\u0440\\u0443\\u043a\\u043e\\u0432\\u043e\\u0434\\u0441\\u0442\\u0432\\u0430 \\u043d\\u0435 \\u043d\\u0430\\u0440\\u0443\\u0448\\u0430\\u044e\\u0442\\u0441\\u044f.", "common_text_negative": "\\u0418\\u0441\\u043f\\u043e\\u043b\\u043d\\u0438\\u0442\\u0435\\u043b\\u044c\\u0441\\u043a\\u0430\\u044f \\u0434\\u0438\\u0441\\u0446\\u0438\\u043f\\u043b\\u0438\\u043d\\u0430 \\u043d\\u0435 \\u0441\\u043e\\u0431\\u043b\\u044e\\u0434\\u0430\\u0435\\u0442\\u0441\\u044f \\u0432 \\u043f\\u043e\\u043b\\u043d\\u043e\\u043c \\u043e\\u0431\\u044a\\u0451\\u043c\\u0435. \\u0414\\u043e\\u043f\\u0443\\u0449\\u0435\\u043d\\u044b \\u043d\\u0430\\u0440\\u0443\\u0448\\u0435\\u043d\\u0438\\u044f \\u0441\\u0440\\u043e\\u043a\\u043e\\u0432 \\u0438\\u0441\\u043f\\u043e\\u043b\\u043d\\u0435\\u043d\\u0438\\u044f \\u043f\\u0440\\u043e\\u0442\\u043e\\u043a\\u043e\\u043b\\u044c\\u043d\\u044b\\u0445 \\u043f\\u043e\\u0440\\u0443\\u0447\\u0435\\u043d\\u0438\\u0439, \\u043f\\u0440\\u0438\\u043a\\u0430\\u0437\\u043e\\u0432 \\u0438 \\u0440\\u0430\\u0441\\u043f\\u043e\\u0440\\u044f\\u0436\\u0435\\u043d\\u0438\\u0439 \\u0423\\u0447\\u0440\\u0435\\u0436\\u0434\\u0435\\u043d\\u0438\\u044f."}, {"indicator": "\\u041e\\u0431\\u0449\\u0438\\u0435 \\u043f\\u043e\\u043a\\u0430\\u0437\\u0430\\u0442\\u0435\\u043b\\u0438 \\u044d\\u0444\\u0444\\u0435\\u043a\\u0442\\u0438\\u0432\\u043d\\u043e\\u0441\\u0442\\u0438 \\u0438 \\u0440\\u0435\\u0437\\u0443\\u043b\\u044c\\u0442\\u0430\\u0442\\u0438\\u0432\\u043d\\u043e\\u0441\\u0442\\u0438 \\u0434\\u0435\\u044f\\u0442\\u0435\\u043b\\u044c\\u043d\\u043e\\u0441\\u0442\\u0438", "criterion": "\\u0421\\u043e\\u0431\\u043b\\u044e\\u0434\\u0435\\u043d\\u0438\\u0435 \\u041f\\u0440\\u0430\\u0432\\u0438\\u043b \\u0432\\u043d\\u0443\\u0442\\u0440\\u0435\\u043d\\u043d\\u0435\\u0433\\u043e \\u0442\\u0440\\u0443\\u0434\\u043e\\u0432\\u043e\\u0433\\u043e \\u0440\\u0430\\u0441\\u043f\\u043e\\u0440\\u044f\\u0434\\u043a\\u0430, \\u041a\\u043e\\u0434\\u0435\\u043a\\u0441\\u0430 \\u044d\\u0442\\u0438\\u043a\\u0438", "formula_type": "binary_manual", "weight": 10, "is_common": true, "cumulative": false, "kpi_type": "binary_manual", "score": null, "confidence": null, "summary": null, "awaiting_manual_input": true, "requires_fact_input": false, "fact_value": null, "parsed_thresholds": null, "requires_review": false, "ai_low_confidence": false, "common_text_positive": "\\u041f\\u0440\\u0430\\u0432\\u0438\\u043b\\u0430 \\u0432\\u043d\\u0443\\u0442\\u0440\\u0435\\u043d\\u043d\\u0435\\u0433\\u043e \\u0442\\u0440\\u0443\\u0434\\u043e\\u0432\\u043e\\u0433\\u043e \\u0440\\u0430\\u0441\\u043f\\u043e\\u0440\\u044f\\u0434\\u043a\\u0430 \\u0438 \\u041a\\u043e\\u0434\\u0435\\u043a\\u0441\\u0430 \\u044d\\u0442\\u0438\\u043a\\u0438 \\u0441\\u043e\\u0431\\u043b\\u044e\\u0434\\u0430\\u044e\\u0442\\u0441\\u044f \\u0432 \\u043f\\u043e\\u043b\\u043d\\u043e\\u043c \\u043e\\u0431\\u044a\\u0451\\u043c\\u0435.", "common_text_negative": "\\u041f\\u0440\\u0430\\u0432\\u0438\\u043b\\u0430 \\u0432\\u043d\\u0443\\u0442\\u0440\\u0435\\u043d\\u043d\\u0435\\u0433\\u043e \\u0442\\u0440\\u0443\\u0434\\u043e\\u0432\\u043e\\u0433\\u043e \\u0440\\u0430\\u0441\\u043f\\u043e\\u0440\\u044f\\u0434\\u043a\\u0430 \\u0438 \\u041a\\u043e\\u0434\\u0435\\u043a\\u0441\\u0430 \\u044d\\u0442\\u0438\\u043a\\u0438 \\u043d\\u0435 \\u0441\\u043e\\u0431\\u043b\\u044e\\u0434\\u0430\\u044e\\u0442\\u0441\\u044f \\u0432 \\u043f\\u043e\\u043b\\u043d\\u043e\\u043c \\u043e\\u0431\\u044a\\u0451\\u043c\\u0435."}, {"indicator": "\\u041e\\u0431\\u0449\\u0438\\u0435 \\u043f\\u043e\\u043a\\u0430\\u0437\\u0430\\u0442\\u0435\\u043b\\u0438 \\u044d\\u0444\\u0444\\u0435\\u043a\\u0442\\u0438\\u0432\\u043d\\u043e\\u0441\\u0442\\u0438 \\u0438 \\u0440\\u0435\\u0437\\u0443\\u043b\\u044c\\u0442\\u0430\\u0442\\u0438\\u0432\\u043d\\u043e\\u0441\\u0442\\u0438 \\u0434\\u0435\\u044f\\u0442\\u0435\\u043b\\u044c\\u043d\\u043e\\u0441\\u0442\\u0438", "criterion": "\\u0421\\u043e\\u0431\\u043b\\u044e\\u0434\\u0435\\u043d\\u0438\\u0435 \\u043f\\u0440\\u0430\\u0432\\u0438\\u043b \\u0438 \\u043d\\u043e\\u0440\\u043c \\u0442\\u0435\\u0445\\u043d\\u0438\\u043a\\u0438 \\u0431\\u0435\\u0437\\u043e\\u043f\\u0430\\u0441\\u043d\\u043e\\u0441\\u0442\\u0438, \\u043e\\u0445\\u0440\\u0430\\u043d\\u044b \\u0442\\u0440\\u0443\\u0434\\u0430 \\u0438 \\u043f\\u0440\\u043e\\u0442\\u0438\\u0432\\u043e\\u043f\\u043e\\u0436\\u0430\\u0440\\u043d\\u043e\\u0433\\u043e \\u0440\\u0435\\u0436\\u0438\\u043c\\u0430", "formula_type": "binary_manual", "weight": 10, "is_common": true, "cumulative": false, "kpi_type": "binary_manual", "score": null, "confidence": null, "summary": null, "awaiting_manual_input": true, "requires_fact_input": false, "fact_value": null, "parsed_thresholds": null, "requires_review": false, "ai_low_confidence": false, "common_text_positive": "\\u041f\\u0440\\u0430\\u0432\\u0438\\u043b\\u0430 \\u0438 \\u043d\\u043e\\u0440\\u043c\\u044b \\u0442\\u0435\\u0445\\u043d\\u0438\\u043a\\u0438 \\u0431\\u0435\\u0437\\u043e\\u043f\\u0430\\u0441\\u043d\\u043e\\u0441\\u0442\\u0438, \\u043e\\u0445\\u0440\\u0430\\u043d\\u044b \\u0442\\u0440\\u0443\\u0434\\u0430 \\u0438 \\u043f\\u0440\\u043e\\u0442\\u0438\\u0432\\u043e\\u043f\\u043e\\u0436\\u0430\\u0440\\u043d\\u043e\\u0433\\u043e \\u0440\\u0435\\u0436\\u0438\\u043c\\u0430 \\u0441\\u043e\\u0431\\u043b\\u044e\\u0434\\u0430\\u044e\\u0442\\u0441\\u044f \\u0432 \\u043f\\u043e\\u043b\\u043d\\u043e\\u043c \\u043e\\u0431\\u044a\\u0451\\u043c\\u0435.", "common_text_negative": "\\u041f\\u0440\\u0430\\u0432\\u0438\\u043b\\u0430 \\u0438 \\u043d\\u043e\\u0440\\u043c\\u044b \\u0442\\u0435\\u0445\\u043d\\u0438\\u043a\\u0438 \\u0431\\u0435\\u0437\\u043e\\u043f\\u0430\\u0441\\u043d\\u043e\\u0441\\u0442\\u0438, \\u043e\\u0445\\u0440\\u0430\\u043d\\u044b \\u0442\\u0440\\u0443\\u0434\\u0430 \\u0438 \\u043f\\u0440\\u043e\\u0442\\u0438\\u0432\\u043e\\u043f\\u043e\\u0436\\u0430\\u0440\\u043d\\u043e\\u0433\\u043e \\u0440\\u0435\\u0436\\u0438\\u043c\\u0430 \\u043d\\u0435 \\u0441\\u043e\\u0431\\u043b\\u044e\\u0434\\u0430\\u044e\\u0442\\u0441\\u044f \\u0432 \\u043f\\u043e\\u043b\\u043d\\u043e\\u043c \\u043e\\u0431\\u044a\\u0451\\u043c\\u0435."}, {"indicator": "\\u041e\\u0441\\u0443\\u0449\\u0435\\u0441\\u0442\\u0432\\u043b\\u0435\\u043d\\u0438\\u0435 \\u0437\\u0430\\u043a\\u0443\\u043f\\u043e\\u043a \\u0437\\u0430\\u043a\\u0430\\u0437\\u0447\\u0438\\u043a\\u0430\\u043c\\u0438 \\u041c\\u043e\\u0441\\u043a\\u043e\\u0432\\u0441\\u043a\\u043e\\u0439 \\u043e\\u0431\\u043b\\u0430\\u0441\\u0442\\u0438, \\u0432 \\u0441\\u043e\\u043e\\u0442\\u0432\\u0435\\u0442\\u0441\\u0442\\u0432\\u0438\\u0438 \\u0441 \\u0424\\u0435\\u0434\\u0435\\u0440\\u0430\\u043b\\u044c\\u043d\\u044b\\u043c \\u0437\\u0430\\u043a\\u043e\\u043d\\u043e\\u043c \\u043e\\u0442 18.07.2011 \\u2116 223-\\u0424\\u0417 \\u00ab\\u041e \\u0437\\u0430\\u043a\\u0443\\u043f\\u043a\\u0430\\u0445 \\u0442\\u043e\\u0432\\u0430\\u0440\\u043e\\u0432, \\u0440\\u0430\\u0431\\u043e\\u0442, \\u0443\\u0441\\u043b\\u0443\\u0433 \\u043e\\u0442\\u0434\\u0435\\u043b\\u044c\\u043d\\u044b\\u043c\\u0438 \\u0432\\u0438\\u0434\\u0430\\u043c\\u0438 \\u044e\\u0440\\u0438\\u0434\\u0438\\u0447\\u0435\\u0441\\u043a\\u0438\\u0445 \\u043b\\u0438\\u0446\\u00bb (\\u0417\\u0430\\u043a\\u043e\\u043d \\u2116 223-\\u0424\\u0417)", "criterion": "\\u041e\\u0431\\u044a\\u0435\\u043c \\u0437\\u0430\\u043a\\u0443\\u043f\\u043e\\u043a, \\u043e\\u0441\\u0443\\u0449\\u0435\\u0441\\u0442\\u0432\\u043b\\u044f\\u0435\\u043c\\u044b\\u0445 \\u0437\\u0430\\u043a\\u0430\\u0437\\u0447\\u0438\\u043a\\u0430\\u043c\\u0438 \\u041c\\u043e\\u0441\\u043a\\u043e\\u0432\\u0441\\u043a\\u043e\\u0439 \\u043e\\u0431\\u043b\\u0430\\u0441\\u0442\\u0438, \\u043a\\u043e\\u043d\\u043a\\u0443\\u0440\\u0435\\u043d\\u0442\\u043d\\u044b\\u043c\\u0438 \\u0441\\u043f\\u043e\\u0441\\u043e\\u0431\\u0430\\u043c\\u0438\\n(\\u043d\\u0430\\u0440\\u0430\\u0441\\u0442\\u0430\\u044e\\u0449\\u0438\\u043c \\u0438\\u0442\\u043e\\u0433\\u043e\\u043c)", "formula_type": "multi_threshold", "weight": 20, "is_common": false, "cumulative": true, "kpi_type": "numeric", "score": 50.0, "confidence": null, "summary": null, "awaiting_manual_input": false, "requires_fact_input": false, "fact_value": 65.0, "parsed_thresholds": [{"conditions": [">=67%"], "score": 100.0}, {"conditions": ["<67%", ">50%"], "score": 50.0}, {"conditions": ["<50%"], "score": 0.0}], "requires_review": false, "ai_low_confidence": false}]	\N	2026-04-30 07:52:36.565691+00	\N	\N	\N	\N	2026-04-30 07:52:36.565673+00	2026-04-28 10:04:53.81682+00	2026-04-30 07:52:34.033704+00	Проведены совещания и встречи по вопросам правового сопровождения деятельности Учреждения. Подготовлены аналитические данные и отчёты, необходимые для обеспечения правового поля. Выполнена координация проектной деятельности, включая внедрение ИИ, что способствует минимизации рисков привлечения к административной ответственности и взысканий.\n\nПроведены совещания и встречи по вопросам проектной деятельности и внедрения ИИ, подготовлены аналитические данные и отчёты по проектной деятельности. Выполнена координация проектной деятельности и подготовка дорожной карты по проектам внедрения ИИ.	2026-04-30 05:41:49.769643+00
c755a501-6452-4057-bbe9-4d86de33322c	182	ZabeyvorotaMA	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	83	194805	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
7d026680-d9bd-479f-8d4a-8d5c2539e9ba	398	KostinaDaM	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	75	194806	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
e7f11537-4d12-4a20-b064-e5d47c82092a	441	BorisovDO	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	29	194807	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
65e2bd5c-37dd-4564-96c3-80fb736b79bf	91	FerrahLE	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	91	194808	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
80d8a7bc-7fe3-465a-8595-57c89765eeac	156	AlekhinaAL	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	45	194809	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
b524d386-c1f6-44d1-ae77-81fd1234357a	454	BelovaNaEv	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	9	194810	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
0282bc1e-0736-4e9f-a53d-101ca0ffa4b5	338	IvanovaOkAl	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	64	194811	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
5c0b87d1-b9ad-4247-8425-3edddfd628fe	335	TeslinaAS	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	63	194812	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
29c5d1aa-c68b-47cf-9e5b-84a1687dd2da	392	KolomytovRO	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	75	194813	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
f8379563-e5c6-48b8-bdd3-15507b2cde8f	386	KornilovaElA	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	70	194814	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
da8b7699-a46d-43f3-854b-7b71a021fc54	66	DanilovaOS	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	88	194815	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
583fa50b-825e-44f5-a529-e7beebaab8c5	448	BelozerovPA	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	39	194816	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
86603c07-b1b6-443d-879f-7dba984dac67	430	GasanovArSi	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	35	194817	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
a0520e26-4e1e-4e45-9c1c-33b279c977bf	407	MutovkinPA	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	25	194818	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
6a817595-df06-46ce-b1de-07b837197f99	373	ZaichkoVV	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	4	194819	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
70a03d5f-ed4a-43d9-9a4b-814e37af8b27	16	VasilevaIrAl	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	85	194820	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
e03b19fd-ac11-41b6-ac35-3320e88c6bf1	412	AgevninaViA	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	77	194821	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
6d9a5260-b08e-4261-b458-0bc3c58e32fd	59	AlekseevaTaE	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	16	194822	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
39f294b5-7891-4563-be65-7d7d00fca5b3	250	FedorovaNaMi	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	11	194823	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
c0a909bb-5546-4d82-a38f-84a2176a0d94	401	MelnikovaNatMi	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	76	194824	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
127769c0-bcc7-4ffa-ae69-27b2db9d8102	408	GrebeniukovaES	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	60	194825	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
8363b9a3-695e-4569-a95d-4d5e83929e79	447	KhorkovaIuNi	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	32	194826	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
f5bf38f6-fefb-4934-b88d-c381d64209b6	437	ChebushevAnAl	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	60	194827	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
ad72c5ea-2823-49e2-b016-f2025977a724	294	BolshakovaMI	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	13	194828	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
7ef59320-47a1-4bc7-8985-5ab7b9abfd4a	289	VinokurovMiA	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	71	194829	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
1e1db615-cd40-47ef-892d-221d3da6c6e9	154	KhukhrinaEkE	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	21	194830	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
b40eeae2-0fa9-4e85-a188-e4877fcd2cd2	251	IvanovaMaIg	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	86	194831	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
b5534af1-6b95-4273-8e14-87514a89e09b	33	OsokinaGA	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	46	194832	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
b5be5122-ff63-4942-b7d6-69415a59cf19	391	ToroykinPO	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	79	194833	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
67c4831e-57f2-41f7-b9ad-9399fa72616d	255	PetrovaAnnIu	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	81	194834	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
0ce9e1e6-2144-400a-8b18-95a5d83fda46	416	GordienkoEG	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	56	194835	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
f3e8b060-bd14-485b-95a2-f77330c3d5de	245	BaranovOlI	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	86	194836	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
b1d8c531-49e9-4c08-ba72-412cff20dd7e	353	SilakovSA	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	74	194837	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
ebe73542-5988-4b23-a7cd-db6fddc7ad2d	449	KotelnikovVA	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	78	194838	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
96d3861e-0867-4af4-a5c1-d3cf815ccfa5	114	KomarovAnD	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	19	194839	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
c31bbfc8-51af-4833-8705-5ce7b07a34a3	351	AbramovKiA	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	26	194840	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
9fa7855c-34d8-4f1f-ab63-cc9dc9f81b74	296	PoliakovNiD	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	20	194841	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
199e09fd-9ce9-4062-bc62-e47ebf527c32	323	ShatalovaSA	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	87	194842	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
1707255b-4817-412a-86a2-19686b5455c9	370	KhromovaKN	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	52	194843	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
c1189315-ce9a-4779-8f40-92b688a6fe00	111	AstakhovaAlD	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	23	194844	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
e6e82b40-7810-4aee-a2ef-2e232caa33cd	445	EgorovaIriIv	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	65	194845	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
a47bc2a6-ad7e-496e-8930-ad8813784525	32	KozlovDmS	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	48	194846	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
13829556-db1b-4d82-8958-c266cf407278	305	TrushinaAnA	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	13	194847	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
9fb67010-ebfc-4c9c-854c-7fc7ea9ffec5	373	ZaichkoVV	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	75	194397	approved	\N	\N	\N	[{"indicator": "\\u041e\\u0431\\u0435\\u0441\\u043f\\u0435\\u0447\\u0435\\u043d\\u0438\\u0435 \\u043c\\u043e\\u0434\\u0435\\u043b\\u0438\\u0440\\u043e\\u0432\\u0430\\u043d\\u0438\\u044f \\u0431\\u0438\\u0437\\u043d\\u0435\\u0441-\\u043f\\u0440\\u043e\\u0446\\u0435\\u0441\\u0441\\u043e\\u0432", "criterion": "\\u0414\\u0435\\u0442\\u0430\\u043b\\u044c\\u043d\\u043e\\u0435 \\u043e\\u043f\\u0438\\u0441\\u0430\\u043d\\u0438\\u044f \\u0438 \\u0432\\u0438\\u0437\\u0443\\u0430\\u043b\\u044c\\u043d\\u043e\\u0435 \\u043e\\u0442\\u043e\\u0431\\u0440\\u0430\\u0436\\u0435\\u043d\\u0438\\u044f \\u0432\\u0441\\u0435\\u0445 \\u043f\\u0440\\u043e\\u0446\\u0435\\u0441\\u0441\\u043e\\u0432, \\u0441 \\u0438\\u0441\\u043f\\u043e\\u043b\\u044c\\u0437\\u043e\\u0432\\u0430\\u043d\\u0438\\u0435\\u043c \\u0441\\u043f\\u0435\\u0446\\u0438\\u0430\\u043b\\u0438\\u0437\\u0438\\u0440\\u043e\\u0432\\u0430\\u043d\\u043d\\u044b\\u0445 \\u0438\\u043d\\u0441\\u0442\\u0440\\u0443\\u043c\\u0435\\u043d\\u0442\\u0430\\u043b\\u044c\\u043d\\u044b\\u0445 \\u0441\\u0440\\u0435\\u0434\\u0441\\u0442\\u0432 \\u043c\\u043e\\u0434\\u0435\\u043b\\u0438\\u0440\\u043e\\u0432\\u0430\\u043d\\u0438\\u044f.", "formula_type": "binary_auto", "weight": 50, "is_common": false, "cumulative": false, "kpi_type": "binary_auto", "score": 0, "confidence": 20, "summary": "\\u0412 \\u0441\\u0430\\u043c\\u043c\\u0430\\u0440\\u0438 \\u043d\\u0435 \\u0443\\u043a\\u0430\\u0437\\u0430\\u043d\\u043e, \\u0447\\u0442\\u043e \\u0431\\u044b\\u043b\\u0438 \\u043f\\u0440\\u043e\\u0432\\u0435\\u0434\\u0435\\u043d\\u044b \\u0440\\u0430\\u0431\\u043e\\u0442\\u044b \\u043f\\u043e \\u043c\\u043e\\u0434\\u0435\\u043b\\u0438\\u0440\\u043e\\u0432\\u0430\\u043d\\u0438\\u044e \\u0431\\u0438\\u0437\\u043d\\u0435\\u0441-\\u043f\\u0440\\u043e\\u0446\\u0435\\u0441\\u0441\\u043e\\u0432 \\u0441 \\u0438\\u0441\\u043f\\u043e\\u043b\\u044c\\u0437\\u043e\\u0432\\u0430\\u043d\\u0438\\u0435\\u043c \\u0441\\u043f\\u0435\\u0446\\u0438\\u0430\\u043b\\u0438\\u0437\\u0438\\u0440\\u043e\\u0432\\u0430\\u043d\\u043d\\u044b\\u0445 \\u0438\\u043d\\u0441\\u0442\\u0440\\u0443\\u043c\\u0435\\u043d\\u0442\\u0430\\u043b\\u044c\\u043d\\u044b\\u0445 \\u0441\\u0440\\u0435\\u0434\\u0441\\u0442\\u0432.", "awaiting_manual_input": false, "requires_fact_input": false, "fact_value": null, "parsed_thresholds": null, "requires_review": true, "ai_low_confidence": true, "manager_override": true}, {"indicator": "\\u041e\\u0431\\u0449\\u0438\\u0435 \\u043f\\u043e\\u043a\\u0430\\u0437\\u0430\\u0442\\u0435\\u043b\\u0438 \\u044d\\u0444\\u0444\\u0435\\u043a\\u0442\\u0438\\u0432\\u043d\\u043e\\u0441\\u0442\\u0438 \\u0438 \\u0440\\u0435\\u0437\\u0443\\u043b\\u044c\\u0442\\u0430\\u0442\\u0438\\u0432\\u043d\\u043e\\u0441\\u0442\\u0438 \\u0434\\u0435\\u044f\\u0442\\u0435\\u043b\\u044c\\u043d\\u043e\\u0441\\u0442\\u0438", "criterion": "\\u0421\\u043e\\u0431\\u043b\\u044e\\u0434\\u0435\\u043d\\u0438\\u0435 \\u0438\\u0441\\u043f\\u043e\\u043b\\u043d\\u0438\\u0442\\u0435\\u043b\\u044c\\u0441\\u043a\\u043e\\u0439 \\u0434\\u0438\\u0441\\u0446\\u0438\\u043f\\u043b\\u0438\\u043d\\u044b \\u043f\\u0440\\u0438 \\u0440\\u0430\\u0431\\u043e\\u0442\\u0435 \\u0432 \\u043c\\u0435\\u0436\\u0432\\u0435\\u0434\\u043e\\u043c\\u0441\\u0442\\u0432\\u0435\\u043d\\u043d\\u043e\\u0439 \\u0441\\u0438\\u0441\\u0442\\u0435\\u043c\\u0435 \\u044d\\u043b\\u0435\\u043a\\u0442\\u0440\\u043e\\u043d\\u043d\\u043e\\u0433\\u043e \\u0434\\u043e\\u043a\\u0443\\u043c\\u0435\\u043d\\u0442\\u043e\\u043e\\u0431\\u043e\\u0440\\u043e\\u0442\\u0430 \\u041c\\u043e\\u0441\\u043a\\u043e\\u0432\\u0441\\u043a\\u043e\\u0439 \\u043e\\u0431\\u043b\\u0430\\u0441\\u0442\\u0438 (\\u041c\\u0421\\u042d\\u0414, \\n\\u0417\\u041a \\u041c\\u0421\\u042d\\u0414), \\u0441\\u0440\\u043e\\u043a\\u043e\\u0432 \\u0438\\u0441\\u043f\\u043e\\u043b\\u043d\\u0435\\u043d\\u0438\\u044f \\u043f\\u0440\\u043e\\u0442\\u043e\\u043a\\u043e\\u043b\\u044c\\u043d\\u044b\\u0445 \\u043f\\u043e\\u0440\\u0443\\u0447\\u0435\\u043d\\u0438\\u0439, \\u043e\\u0431\\u0440\\u0430\\u0437\\u0443\\u044e\\u0449\\u0438\\u0445\\u0441\\u044f \\u0432 \\u0445\\u043e\\u0434\\u0435 \\u0434\\u0435\\u044f\\u0442\\u0435\\u043b\\u044c\\u043d\\u043e\\u0441\\u0442\\u0438 \\u0423\\u0447\\u0440\\u0435\\u0436\\u0434\\u0435\\u043d\\u0438\\u044f, \\u0441\\u0440\\u043e\\u043a\\u043e\\u0432 \\u0438\\u0441\\u043f\\u043e\\u043b\\u043d\\u0435\\u043d\\u0438\\u044f \\u043f\\u0440\\u0438\\u043a\\u0430\\u0437\\u043e\\u0432 \\u0438 \\u0440\\u0430\\u0441\\u043f\\u043e\\u0440\\u044f\\u0436\\u0435\\u043d\\u0438\\u0439 \\u0423\\u0447\\u0440\\u0435\\u0436\\u0434\\u0435\\u043d\\u0438\\u044f, \\u043f\\u0438\\u0441\\u044c\\u043c\\u0435\\u043d\\u043d\\u044b\\u0445 \\u0438 \\u0443\\u0441\\u0442\\u043d\\u044b\\u0445 \\u043f\\u043e\\u0440\\u0443\\u0447\\u0435\\u043d\\u0438\\u0439 \\u0440\\u0443\\u043a\\u043e\\u0432\\u043e\\u0434\\u0441\\u0442\\u0432\\u0430", "formula_type": "binary_manual", "weight": 30, "is_common": true, "cumulative": false, "kpi_type": "binary_manual", "score": 100.0, "confidence": null, "summary": null, "awaiting_manual_input": false, "requires_fact_input": false, "fact_value": null, "parsed_thresholds": null, "requires_review": false, "ai_low_confidence": false, "reviewer_comment": "", "reviewed_at": "2026-04-29T11:48:12.307120"}, {"indicator": "\\u041e\\u0431\\u0449\\u0438\\u0435 \\u043f\\u043e\\u043a\\u0430\\u0437\\u0430\\u0442\\u0435\\u043b\\u0438 \\u044d\\u0444\\u0444\\u0435\\u043a\\u0442\\u0438\\u0432\\u043d\\u043e\\u0441\\u0442\\u0438 \\u0438 \\u0440\\u0435\\u0437\\u0443\\u043b\\u044c\\u0442\\u0430\\u0442\\u0438\\u0432\\u043d\\u043e\\u0441\\u0442\\u0438 \\u0434\\u0435\\u044f\\u0442\\u0435\\u043b\\u044c\\u043d\\u043e\\u0441\\u0442\\u0438", "criterion": "\\u0421\\u043e\\u0431\\u043b\\u044e\\u0434\\u0435\\u043d\\u0438\\u0435 \\u041f\\u0440\\u0430\\u0432\\u0438\\u043b \\u0432\\u043d\\u0443\\u0442\\u0440\\u0435\\u043d\\u043d\\u0435\\u0433\\u043e \\u0442\\u0440\\u0443\\u0434\\u043e\\u0432\\u043e\\u0433\\u043e \\u0440\\u0430\\u0441\\u043f\\u043e\\u0440\\u044f\\u0434\\u043a\\u0430, \\u041a\\u043e\\u0434\\u0435\\u043a\\u0441\\u0430 \\u044d\\u0442\\u0438\\u043a\\u0438", "formula_type": "binary_manual", "weight": 10, "is_common": true, "cumulative": false, "kpi_type": "binary_manual", "score": 0.0, "confidence": null, "summary": null, "awaiting_manual_input": false, "requires_fact_input": false, "fact_value": null, "parsed_thresholds": null, "requires_review": false, "ai_low_confidence": false, "reviewer_comment": "", "reviewed_at": "2026-04-29T11:49:20.709549"}, {"indicator": "\\u041e\\u0431\\u0449\\u0438\\u0435 \\u043f\\u043e\\u043a\\u0430\\u0437\\u0430\\u0442\\u0435\\u043b\\u0438 \\u044d\\u0444\\u0444\\u0435\\u043a\\u0442\\u0438\\u0432\\u043d\\u043e\\u0441\\u0442\\u0438 \\u0438 \\u0440\\u0435\\u0437\\u0443\\u043b\\u044c\\u0442\\u0430\\u0442\\u0438\\u0432\\u043d\\u043e\\u0441\\u0442\\u0438 \\u0434\\u0435\\u044f\\u0442\\u0435\\u043b\\u044c\\u043d\\u043e\\u0441\\u0442\\u0438", "criterion": "\\u0421\\u043e\\u0431\\u043b\\u044e\\u0434\\u0435\\u043d\\u0438\\u0435 \\u043f\\u0440\\u0430\\u0432\\u0438\\u043b \\u0438 \\u043d\\u043e\\u0440\\u043c \\u0442\\u0435\\u0445\\u043d\\u0438\\u043a\\u0438 \\u0431\\u0435\\u0437\\u043e\\u043f\\u0430\\u0441\\u043d\\u043e\\u0441\\u0442\\u0438, \\u043e\\u0445\\u0440\\u0430\\u043d\\u044b \\u0442\\u0440\\u0443\\u0434\\u0430 \\u0438 \\u043f\\u0440\\u043e\\u0442\\u0438\\u0432\\u043e\\u043f\\u043e\\u0436\\u0430\\u0440\\u043d\\u043e\\u0433\\u043e \\u0440\\u0435\\u0436\\u0438\\u043c\\u0430", "formula_type": "binary_manual", "weight": 10, "is_common": true, "cumulative": false, "kpi_type": "binary_manual", "score": 100.0, "confidence": null, "summary": null, "awaiting_manual_input": false, "requires_fact_input": false, "fact_value": null, "parsed_thresholds": null, "requires_review": false, "ai_low_confidence": false, "reviewer_comment": "", "reviewed_at": "2026-04-29T11:48:15.019998"}]		2026-04-29 10:20:44.892283+00	373	ZaichkoVV	\N	2026-04-29 14:56:45.450919+00	2026-04-29 10:20:44.892246+00	2026-04-28 10:09:04.491299+00	2026-04-29 14:56:45.440589+00	Проведены совещания по проектам трансформации, цифровой трансформации и внедрению ИИ. Подготовлены аналитические данные по проектной деятельности и презентация по итогам деятельности за 1 квартал. Разработан модуль формирования отчётов в системе Redmine. Выполнена доработка Redmine в рамках проекта «Автоформирование отчёта KPI». Подготовлены отчёты по проектам цифровой трансформации и об организации удалённой работы. Защищены KPI за 1 квартал у министра. Заполнение ДК и добавление этапа закрытия проекта в РМ «Трансформация». Обновлены данные на дашборде и загружены актуальные данные в базу данных, доработана структура. Обобщены данные для формирования отчёта по проектам для МНА. Подготовлены материалы для содоклада с Мингос и к совещанию у министра.	2026-04-29 10:19:01.125772+00
263f437a-9636-4fb4-b3d0-a739be06877b	451	MatveevaKA	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	14	194769	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
ad82b7f4-a0a9-4364-9443-df0ca4201ca2	129	KorablinaOlN	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	2	194770	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
e1a51ea7-66cc-41cc-9fed-6f31ea1d2d02	357	KoriakinaEA	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	36	194771	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
f872838b-6954-4eda-94c2-c8792c61aa4a	457	AmelinaDR	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	66	194772	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
15dbbea2-9f4f-4ad6-94f9-8ef2dcd65080	152	BerezkinAS	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	34	194773	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
5b1b1599-bf26-4cc0-a218-b45bff15b53f	393	VolodinKO	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	82	194774	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
3caabfec-a201-4d69-a399-b2ec89753ef7	455	AgaevDE	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	29	194775	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
f25f193b-71e3-4889-8001-bcac9804aea8	411	BeltiugovRV	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	73	194776	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
0b7a33dd-56c4-4970-9fe0-7ed7f379aa58	446	DemidiukIaN	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	8	194777	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
d97c99ef-acdc-44f4-92b5-34066f981da3	377	ZavialovaEI	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	9	194778	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
5c1e335b-9d83-496b-bb71-5b1f7022b420	415	ShestakMV	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	41	194779	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
f9f34db6-ae14-4a82-a6ef-ed00c5fc3cd3	383	PetuninaEvAn	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	7	194780	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
4306510c-f020-4530-8509-8259a9bdc62c	343	KhasarokovaSS	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	68	194781	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
99367801-c4a5-4860-bf2b-974578ed7700	144	FedorovaTatAn	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	37	194782	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
f2e5ee4a-38cd-4d1d-9ac0-80fddbc776a1	432	KukartsevaOV	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	42	194783	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
33bc2023-be10-4e50-8361-a285c754b762	389	KhorevOlG	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	3	194784	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
9307c432-3d55-42f4-832f-0331ca443c56	352	KorotaevaNP	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	55	194785	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
a2edd983-c20e-4aab-af82-7c3f138fc2af	409	KolmogortsevaVD	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	36	194786	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
1dd2ea86-6eb5-45c4-9a4c-12cfb34b0e29	410	AdrianovskaiaElI	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	80	194787	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
3632d0e7-39d2-47e9-95a4-4612292b439f	440	KorolkovaDA	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	90	194788	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
e9cdabd2-6963-4a41-97cc-0bb9ffeb87a6	312	KovalskiyPM	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	6	194789	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
4702ed6a-9428-4fb7-a771-5db72e54f3a2	215	MeliukhKV	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	18	194790	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
4d3f175e-fcfe-4c18-a4da-40e16d73abae	434	ElokhinaTA	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	69	194791	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
a8ec958a-ebe8-4bae-a008-db438d230dc2	112	PetrovAlMi	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	28	194792	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
efba627c-5f45-4f32-9eab-4aeaa60431be	199	UlevichES	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	54	194793	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
69d66cb1-a15d-4f63-9c36-60b5514f96f4	244	PozdniakovaTS	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	72	194794	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
fa556933-424b-4e2d-82ea-f172cb7fe77e	365	MaykovaVaS	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	23	194795	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
e41931f5-10f0-44bd-93db-f5a96b4eb3b3	431	KhalikovaAI	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	60	194796	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
b9e9896d-c742-4ddb-aed4-eef222abd5ea	371	ChaykaMaO	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	17	194797	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
1dcf6ea2-e714-479e-8478-fab567f1ac97	400	KulikovaVN	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	57	194798	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
605e5850-6310-4b38-8c1c-8ead5d444c79	248	OsipovaNaAn	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	67	194799	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
78a77b4b-509f-4859-9431-ac04e7ba4b62	443	TalkoND	987df693-829b-41e8-87a2-c90bcebee5fa	ТЕСТ	65	194800	draft	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-30 13:21:51.503842+00	\N	\N	\N
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: kpi_user
--

COPY public.notifications (id, recipient_redmine_id, recipient_login, recipient_telegram_id, notification_type, text, period_id, period_name, submission_id, status, error_message, dedup_key, sent_at, created_at) FROM stdin;
\.


--
-- Data for Name: period_exceptions; Type: TABLE DATA; Schema: public; Owner: kpi_user
--

COPY public.period_exceptions (id, period_id, employee_redmine_id, employee_login, exception_type, event_date, new_position_id, new_department_code, comment, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: periods; Type: TABLE DATA; Schema: public; Owner: kpi_user
--

COPY public.periods (id, period_type, year, month, quarter, name, date_start, date_end, submit_deadline, review_deadline, status, redmine_tasks_created, redmine_tasks_count, created_by, created_at, updated_at) FROM stdin;
42726350-4f89-4d6d-b85d-33d4a7bc1eab	monthly	2026	4	\N	Апрель 2026	2026-04-30	2026-04-30	2026-04-30	2026-04-30	draft	f	0	ZaichkoVV	2026-04-30 13:19:30.977539+00	\N
987df693-829b-41e8-87a2-c90bcebee5fa	monthly	2026	4	\N	ТЕСТ	2026-04-01	2026-04-30	2026-04-27	2026-04-29	active	t	79	ZaichkoVV	2026-04-28 10:00:57.937857+00	2026-04-30 13:21:51.503842+00
\.


--
-- Data for Name: subordination; Type: TABLE DATA; Schema: public; Owner: kpi_user
--

COPY public.subordination (position_id, evaluator_id, updated_at) FROM stdin;
РУК_ПЕРЗ_001	\N	2026-05-02 18:39:53.114918+00
РУК_ЗАМД_002	\N	2026-05-02 18:39:53.114918+00
РУК_ЗАМД_003	\N	2026-05-02 18:39:53.114918+00
РУК_ЗАМД_004	\N	2026-05-02 18:39:53.114918+00
ОРГ_ЗАМ_006	ОРГ_НАЧ_005	2026-05-02 18:39:53.114918+00
ОРГ_ЗАМ_НАЧ_ОТД_007	ОРГ_НАЧ_005	2026-05-02 18:39:53.114918+00
ОРГ_ЗАМ_НАЧ_ОТД_011	ОРГ_НАЧ_005	2026-05-02 18:39:53.114918+00
ОРГ_НАЧ_ОТД_016	ОРГ_НАЧ_005	2026-05-02 18:39:53.114918+00
ОРГ_ЗАМ_ОТД_008	ОРГ_ЗАМ_НАЧ_ОТД_007	2026-05-02 18:39:53.114918+00
ОРГ_КОН_009	ОРГ_ЗАМ_НАЧ_ОТД_007	2026-05-02 18:39:53.114918+00
ОРГ_КОН_010	ОРГ_ЗАМ_НАЧ_ОТД_007	2026-05-02 18:39:53.114918+00
ОРГ_ЗАМ_ОТД_012	ОРГ_ЗАМ_НАЧ_ОТД_011	2026-05-02 18:39:53.114918+00
ОРГ_ГСП_013	ОРГ_ЗАМ_НАЧ_ОТД_011	2026-05-02 18:39:53.114918+00
ОРГ_КОН_014	ОРГ_ЗАМ_НАЧ_ОТД_011	2026-05-02 18:39:53.114918+00
ОРГ_КОН_015	ОРГ_ЗАМ_НАЧ_ОТД_011	2026-05-02 18:39:53.114918+00
ОРГ_ЗАМ_ОТД_017	ОРГ_НАЧ_ОТД_016	2026-05-02 18:39:53.114918+00
ОРГ_КОН_018	ОРГ_НАЧ_ОТД_016	2026-05-02 18:39:53.114918+00
ЕАС_ЗАМ_020	ЕАС_НАЧ_019	2026-05-02 18:39:53.114918+00
ЕАС_ЗАМ_НАЧ_ОТД_021	ЕАС_НАЧ_019	2026-05-02 18:39:53.114918+00
ЕАС_НАЧ_ОТД_027	ЕАС_НАЧ_019	2026-05-02 18:39:53.114918+00
ЕАС_НАЧ_019	РУК_ЗАМД_003	2026-05-02 18:39:53.114918+00
ЕАС_ЗАМ_ОТД_022	ЕАС_ЗАМ_НАЧ_ОТД_021	2026-05-02 18:39:53.114918+00
ЕАС_КОН_023	ЕАС_ЗАМ_НАЧ_ОТД_021	2026-05-02 18:39:53.114918+00
ЕАС_КОН_024	ЕАС_ЗАМ_НАЧ_ОТД_021	2026-05-02 18:39:53.114918+00
ЕАС_КОН_025	ЕАС_ЗАМ_НАЧ_ОТД_021	2026-05-02 18:39:53.114918+00
ЕАС_КОН_026	ЕАС_ЗАМ_НАЧ_ОТД_021	2026-05-02 18:39:53.114918+00
ЕАС_ЗАМ_ОТД_028	ЕАС_НАЧ_ОТД_027	2026-05-02 18:39:53.114918+00
ЕАС_КОН_029	ЕАС_НАЧ_ОТД_027	2026-05-02 18:39:53.114918+00
ЕАС_КОН_030	ЕАС_НАЧ_ОТД_027	2026-05-02 18:39:53.114918+00
ЕАС_ГСП_031	ЕАС_НАЧ_ОТД_027	2026-05-02 18:39:53.114918+00
ПРА_ЗАМ_033	ПРА_НАЧ_032	2026-05-02 18:39:53.114918+00
ПРА_ЗАМ_НАЧ_ОТД_034	ПРА_НАЧ_032	2026-05-02 18:39:53.114918+00
ПРА_ЗАМ_НАЧ_ОТД_038	ПРА_НАЧ_032	2026-05-02 18:39:53.114918+00
ПРА_НАЧ_032	РУК_ПЕРЗ_001	2026-05-02 18:39:53.114918+00
ПРА_ЗАМ_ОТД_035	ПРА_ЗАМ_НАЧ_ОТД_034	2026-05-02 18:39:53.114918+00
ПРА_КОН_036	ПРА_ЗАМ_НАЧ_ОТД_034	2026-05-02 18:39:53.114918+00
ПРА_КОН_037	ПРА_ЗАМ_НАЧ_ОТД_034	2026-05-02 18:39:53.114918+00
ПРА_ЗАМ_ОТД_039	ПРА_ЗАМ_НАЧ_ОТД_038	2026-05-02 18:39:53.114918+00
ПРА_КОН_040	ПРА_ЗАМ_НАЧ_ОТД_038	2026-05-02 18:39:53.114918+00
ПРА_ГАН_041	ПРА_ЗАМ_НАЧ_ОТД_038	2026-05-02 18:39:53.114918+00
КЗА_ЗАМ_043	КЗА_НАЧ_042	2026-05-02 18:39:53.114918+00
КЗА_ЗАМ_НАЧ_ОТД_044	КЗА_НАЧ_042	2026-05-02 18:39:53.114918+00
КЗА_ЗАМ_НАЧ_ОТД_048	КЗА_НАЧ_042	2026-05-02 18:39:53.114918+00
КЗА_НАЧ_042	РУК_ПЕРЗ_001	2026-05-02 18:39:53.114918+00
КЗА_ЗАМ_ОТД_045	КЗА_ЗАМ_НАЧ_ОТД_044	2026-05-02 18:39:53.114918+00
КЗА_КОН_046	КЗА_ЗАМ_НАЧ_ОТД_044	2026-05-02 18:39:53.114918+00
КЗА_ГАН_047	КЗА_ЗАМ_НАЧ_ОТД_044	2026-05-02 18:39:53.114918+00
КЗА_ЗАМ_ОТД_049	КЗА_ЗАМ_НАЧ_ОТД_048	2026-05-02 18:39:53.114918+00
КЗА_КОН_050	КЗА_ЗАМ_НАЧ_ОТД_048	2026-05-02 18:39:53.114918+00
КЗА_ГСП_051	КЗА_ЗАМ_НАЧ_ОТД_048	2026-05-02 18:39:53.114918+00
ЗПД_ЗАМ_053	ЗПД_НАЧ_052	2026-05-02 18:39:53.114918+00
ЗПД_ЗАМ_НАЧ_ОТД_054	ЗПД_НАЧ_052	2026-05-02 18:39:53.114918+00
ЗПД_ЗАМ_НАЧ_ОТД_058	ЗПД_НАЧ_052	2026-05-02 18:39:53.114918+00
ЗПД_НАЧ_052	РУК_ЗАМД_002	2026-05-02 18:39:53.114918+00
ЗПД_ЗАМ_ОТД_055	ЗПД_ЗАМ_НАЧ_ОТД_054	2026-05-02 18:39:53.114918+00
ЗПД_КОН_056	ЗПД_ЗАМ_НАЧ_ОТД_054	2026-05-02 18:39:53.114918+00
ЗПД_ГСП_057	ЗПД_ЗАМ_НАЧ_ОТД_054	2026-05-02 18:39:53.114918+00
ЗПД_ЗАМ_ОТД_059	ЗПД_ЗАМ_НАЧ_ОТД_058	2026-05-02 18:39:53.114918+00
ЗПД_КОН_060	ЗПД_ЗАМ_НАЧ_ОТД_058	2026-05-02 18:39:53.114918+00
ЗПР_ЗАМ_062	ЗПР_НАЧ_061	2026-05-02 18:39:53.114918+00
ЗПР_ЗАМ_НАЧ_ОТД_063	ЗПР_НАЧ_061	2026-05-02 18:39:53.114918+00
ЗПР_ЗАМ_НАЧ_ОТД_067	ЗПР_НАЧ_061	2026-05-02 18:39:53.114918+00
ЗПР_НАЧ_061	РУК_ЗАМД_002	2026-05-02 18:39:53.114918+00
ЗПР_ЗАМ_ОТД_064	ЗПР_ЗАМ_НАЧ_ОТД_063	2026-05-02 18:39:53.114918+00
ЗПР_КОН_065	ЗПР_ЗАМ_НАЧ_ОТД_063	2026-05-02 18:39:53.114918+00
ЗПР_ГСП_066	ЗПР_ЗАМ_НАЧ_ОТД_063	2026-05-02 18:39:53.114918+00
ЗПР_ЗАМ_ОТД_068	ЗПР_ЗАМ_НАЧ_ОТД_067	2026-05-02 18:39:53.114918+00
ЗПР_КОН_069	ЗПР_ЗАМ_НАЧ_ОТД_067	2026-05-02 18:39:53.114918+00
ЗПР_ГСП_070	ЗПР_ЗАМ_НАЧ_ОТД_067	2026-05-02 18:39:53.114918+00
ЦТР_ЗАМ_072	ЦТР_НАЧ_071	2026-05-02 18:39:53.114918+00
ЦТР_ЗАМ_НАЧ_ОТД_073	ЦТР_НАЧ_071	2026-05-02 18:39:53.114918+00
ЦТР_ЗАМ_НАЧ_ОТД_077	ЦТР_НАЧ_071	2026-05-02 18:39:53.114918+00
ЦТР_НАЧ_071	РУК_ЗАМД_004	2026-05-02 18:39:53.114918+00
ЦТР_ЗАМ_ОТД_074	ЦТР_ЗАМ_НАЧ_ОТД_073	2026-05-02 18:39:53.114918+00
ЦТР_КОН_075	ЦТР_ЗАМ_НАЧ_ОТД_073	2026-05-02 18:39:53.114918+00
ЦТР_ГСП_076	ЦТР_ЗАМ_НАЧ_ОТД_073	2026-05-02 18:39:53.114918+00
ЦТР_ЗАМ_ОТД_078	ЦТР_ЗАМ_НАЧ_ОТД_077	2026-05-02 18:39:53.114918+00
ЦТР_КОН_079	ЦТР_ЗАМ_НАЧ_ОТД_077	2026-05-02 18:39:53.114918+00
ЦТР_КОН_080	ЦТР_ЗАМ_НАЧ_ОТД_077	2026-05-02 18:39:53.114918+00
ААД_ЗАМ_082	ААД_НАЧ_081	2026-05-02 18:39:53.114918+00
ААД_ЗАМ_НАЧ_ОТД_083	ААД_НАЧ_081	2026-05-02 18:39:53.114918+00
ААД_НАЧ_ОТД_088	ААД_НАЧ_081	2026-05-02 18:39:53.114918+00
ААД_НАЧ_081	РУК_ЗАМД_004	2026-05-02 18:39:53.114918+00
ААД_ЗАМ_ОТД_084	ААД_ЗАМ_НАЧ_ОТД_083	2026-05-02 18:39:53.114918+00
ААД_КОН_085	ААД_ЗАМ_НАЧ_ОТД_083	2026-05-02 18:39:53.114918+00
ААД_КОН_086	ААД_ЗАМ_НАЧ_ОТД_083	2026-05-02 18:39:53.114918+00
ААД_КОН_087	ААД_ЗАМ_НАЧ_ОТД_083	2026-05-02 18:39:53.114918+00
ААД_ЗАМ_ОТД_089	ААД_НАЧ_ОТД_088	2026-05-02 18:39:53.114918+00
ААД_КОН_090	ААД_НАЧ_ОТД_088	2026-05-02 18:39:53.114918+00
ААД_КОН_091	ААД_НАЧ_ОТД_088	2026-05-02 18:39:53.114918+00
ОРГ_НАЧ_005	\N	2026-05-03 06:43:06.272127+00
\.


--
-- Data for Name: sync_log; Type: TABLE DATA; Schema: public; Owner: kpi_user
--

COPY public.sync_log (id, sync_type, status, total, created_count, updated_count, dismissed_count, errors_count, details, started_at, finished_at) FROM stdin;
79f28add-5355-4584-aef9-70c8cb3dea2c	employees	success	81	81	0	0	0	[{"action": "created", "login": "AbramovKiA", "dept": "kpi-feo"}, {"action": "created", "login": "AdrianovskaiaElI", "dept": "kpi-tsr"}, {"action": "created", "login": "AgaevDE", "dept": "kpi-feo"}, {"action": "created", "login": "AgevninaViA", "dept": "kpi-tsr"}, {"action": "created", "login": "AkhsianovaAK", "dept": "kpi-org"}, {"action": "created", "login": "AlekhinaAL", "dept": "kpi-kza"}, {"action": "created", "login": "AlekseevaTaE", "dept": "kpi-org"}, {"action": "created", "login": "AmelinaDR", "dept": "kpi-zpr"}, {"action": "created", "login": "AstakhovaAlD", "dept": "kpi-feo"}, {"action": "created", "login": "BaranovOlI", "dept": "kpi-iaa"}, {"action": "created", "login": "BelovaNaEv", "dept": "kpi-org"}, {"action": "created", "login": "BelozerovPA", "dept": "kpi-pra"}, {"action": "created", "login": "BeltiugovRV", "dept": "kpi-tsr"}, {"action": "created", "login": "BerezkinAS", "dept": "kpi-pra"}, {"action": "created", "login": "BolshakovaMI", "dept": "kpi-org"}, {"action": "created", "login": "BorisovDO", "dept": "kpi-feo"}, {"action": "created", "login": "ChaykaMaO", "dept": "kpi-org"}, {"action": "created", "login": "ChebushevAnAl", "dept": "kpi-zpd"}, {"action": "created", "login": "DanilovaOS", "dept": "kpi-iaa"}, {"action": "created", "login": "DaniushevskaiaSM", "dept": "kpi-zpd"}, {"action": "created", "login": "DemidiukIaN", "dept": "kpi-org"}, {"action": "created", "login": "EgorovaIriIv", "dept": "kpi-zpr"}, {"action": "created", "login": "ElokhinaTA", "dept": "kpi-zpr"}, {"action": "created", "login": "ErmakovaAnaIu", "dept": "kpi-org"}, {"action": "created", "login": "FedorovaNaMi", "dept": "kpi-org"}, {"action": "created", "login": "FedorovaTatAn", "dept": "kpi-pra"}, {"action": "created", "login": "FerrahLE", "dept": "kpi-iaa"}, {"action": "created", "login": "GasanovArSi", "dept": "kpi-pra"}, {"action": "created", "login": "GordienkoEG", "dept": "kpi-zpd"}, {"action": "created", "login": "GrebeniukovaES", "dept": "kpi-zpd"}, {"action": "created", "login": "IvanovaMaIg", "dept": "kpi-iaa"}, {"action": "created", "login": "IvanovaOkAl", "dept": "kpi-zpr"}, {"action": "created", "login": "KhalikovaAI", "dept": "kpi-zpd"}, {"action": "created", "login": "KhasarokovaSS", "dept": "kpi-zpr"}, {"action": "created", "login": "KhorevOlG", "dept": "kpi-ruk"}, {"action": "created", "login": "KhorkovaIuNi", "dept": "kpi-pra"}, {"action": "created", "login": "KhromovaKN", "dept": "kpi-zpd"}, {"action": "created", "login": "KhukhrinaEkE", "dept": "kpi-feo"}, {"action": "created", "login": "KolmogortsevaVD", "dept": "kpi-pra"}, {"action": "created", "login": "KolomytovRO", "dept": "kpi-tsr"}, {"action": "created", "login": "KomarovAnD", "dept": "kpi-feo"}, {"action": "created", "login": "KorablinaOlN", "dept": "kpi-ruk"}, {"action": "created", "login": "KoriakinaEA", "dept": "kpi-pra"}, {"action": "created", "login": "KornilovaElA", "dept": "kpi-zpr"}, {"action": "created", "login": "KorolkovaDA", "dept": "kpi-iaa"}, {"action": "created", "login": "KorotaevaNP", "dept": "kpi-zpd"}, {"action": "created", "login": "KostinaDaM", "dept": "kpi-tsr"}, {"action": "created", "login": "KostrovaIV", "dept": "kpi-org"}, {"action": "created", "login": "KotelnikovVA", "dept": "kpi-tsr"}, {"action": "created", "login": "KovalskiyPM", "dept": "kpi-org"}, {"action": "created", "login": "KozlovDmS", "dept": "kpi-kza"}, {"action": "created", "login": "KukartsevaOV", "dept": "kpi-kza"}, {"action": "created", "login": "KulikovaVN", "dept": "kpi-zpd"}, {"action": "created", "login": "LuzhakovaTI", "dept": "kpi-iaa"}, {"action": "created", "login": "MatveevaKA", "dept": "kpi-org"}, {"action": "created", "login": "MaykovaVaS", "dept": "kpi-feo"}, {"action": "created", "login": "MeliukhKV", "dept": "kpi-org"}, {"action": "created", "login": "MelnikovaNatMi", "dept": "kpi-tsr"}, {"action": "created", "login": "MutovkinPA", "dept": "kpi-feo"}, {"action": "created", "login": "NuzhdovaZA", "dept": "kpi-zpd"}, {"action": "created", "login": "OsipovaNaAn", "dept": "kpi-zpr"}, {"action": "created", "login": "OsokinaGA", "dept": "kpi-kza"}, {"action": "created", "login": "PetrovaAnnIu", "dept": "kpi-iaa"}, {"action": "created", "login": "PetrovAlMi", "dept": "kpi-feo"}, {"action": "created", "login": "PetuninaEvAn", "dept": "kpi-org"}, {"action": "created", "login": "PoliakovNiD", "dept": "kpi-feo"}, {"action": "created", "login": "PozdniakovaTS", "dept": "kpi-tsr"}, {"action": "created", "login": "ShatalovaSA", "dept": "kpi-iaa"}, {"action": "created", "login": "ShestakMV", "dept": "kpi-pra"}, {"action": "created", "login": "SilakovSA", "dept": "kpi-tsr"}, {"action": "created", "login": "TalkoND", "dept": "kpi-zpr"}, {"action": "created", "login": "TeslinaAS", "dept": "kpi-zpr"}, {"action": "created", "login": "ToroykinPO", "dept": "kpi-tsr"}, {"action": "created", "login": "TrushinaAnA", "dept": "kpi-org"}, {"action": "created", "login": "UlevichES", "dept": "kpi-zpd"}, {"action": "created", "login": "VasilevaIrAl", "dept": "kpi-iaa"}, {"action": "created", "login": "VinokurovMiA", "dept": "kpi-tsr"}, {"action": "created", "login": "VolodinKO", "dept": "kpi-iaa"}, {"action": "created", "login": "ZabeyvorotaMA", "dept": "kpi-iaa"}, {"action": "created", "login": "ZaichkoVV", "dept": "kpi-ruk"}, {"action": "created", "login": "ZavialovaEI", "dept": "kpi-org"}]	2026-04-14 18:02:31.686758+00	2026-04-14 18:02:43.478001+00
77fa816b-153e-4baf-a198-472147c679a4	employees	success	81	0	0	0	0	[]	2026-04-14 18:08:49.440691+00	2026-04-14 18:09:05.712144+00
e02b3447-5c73-476d-bff3-e083148f97ea	employees	success	81	0	0	0	0	[]	2026-04-16 18:26:52.145798+00	2026-04-16 18:27:10.793652+00
6b7b904e-93e2-4ac5-be1d-9a3d3c3faa7e	employees	success	81	0	0	0	0	[]	2026-04-18 12:35:33.501736+00	2026-04-18 12:35:53.529266+00
66cc71b2-4749-4615-8937-785616574408	employees	success	81	0	0	0	0	[]	2026-04-19 14:45:01.448162+00	2026-04-19 14:45:18.702084+00
96a443c0-d3ca-4678-8521-1036e7dc8801	employees	success	79	0	0	2	0	[{"action": "dismissed", "login": "AkhsianovaAK"}, {"action": "dismissed", "login": "ErmakovaAnaIu"}]	2026-04-24 17:18:23.854024+00	2026-04-24 17:18:36.083703+00
7155dd17-6584-4d2e-b779-4e179aa8f3b1	employees	success	79	0	0	0	0	[]	2026-04-24 18:44:56.612122+00	2026-04-24 18:45:26.011124+00
ff008899-6251-42a5-9a82-65bd5e8a8534	employees	success	79	0	0	0	0	[]	2026-04-24 21:42:11.118415+00	2026-04-24 21:42:21.74918+00
84705caf-cf02-48a4-b985-ded2c49c52b8	employees	success	79	0	0	0	0	[]	2026-04-28 07:51:06.235943+00	2026-04-28 07:51:20.143925+00
ae235b10-44da-492d-b64f-44f3d76a3316	employees	success	79	0	0	0	0	[]	2026-04-28 13:53:15.440805+00	2026-04-28 13:53:33.579093+00
cb4ce54c-b2b8-4dd8-829e-cd21d407a1bf	employees	success	79	0	0	0	0	[]	2026-04-30 12:22:47.521883+00	2026-04-30 12:23:03.495446+00
4d847a62-914a-4582-83d0-ce5b25da776e	employees	success	79	0	0	0	0	[]	2026-05-02 18:36:59.112609+00	2026-05-02 18:37:10.403885+00
f50a072c-b861-43d7-8ef3-6dfea2fb7063	employees	success	79	0	0	0	0	[]	2026-05-03 06:34:22.79835+00	2026-05-03 06:34:34.542968+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: kpi_user
--

COPY public.users (id, redmine_id, login, firstname, lastname, email, role, department, position_id, telegram_id, is_active, last_synced_at, created_at, updated_at) FROM stdin;
c5d66c66-e934-401b-a10d-2675948edcf8	373	ZaichkoVV	Валерий	Заичко	ZaichkoVV@mosreg.ru	admin	\N	\N	\N	t	2026-05-04 11:41:11.550996+00	2026-04-14 17:20:30.252611+00	2026-05-04 11:41:11.541003+00
\.


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: kpi_user
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: kpi_user
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: deputy_assignments deputy_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: kpi_user
--

ALTER TABLE ONLY public.deputy_assignments
    ADD CONSTRAINT deputy_assignments_pkey PRIMARY KEY (id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: kpi_user
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: kpi_change_requests kpi_change_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: kpi_user
--

ALTER TABLE ONLY public.kpi_change_requests
    ADD CONSTRAINT kpi_change_requests_pkey PRIMARY KEY (id);


--
-- Name: kpi_criteria kpi_criteria_pkey; Type: CONSTRAINT; Schema: public; Owner: kpi_user
--

ALTER TABLE ONLY public.kpi_criteria
    ADD CONSTRAINT kpi_criteria_pkey PRIMARY KEY (id);


--
-- Name: kpi_indicators kpi_indicators_code_key; Type: CONSTRAINT; Schema: public; Owner: kpi_user
--

ALTER TABLE ONLY public.kpi_indicators
    ADD CONSTRAINT kpi_indicators_code_key UNIQUE (code);


--
-- Name: kpi_indicators kpi_indicators_pkey; Type: CONSTRAINT; Schema: public; Owner: kpi_user
--

ALTER TABLE ONLY public.kpi_indicators
    ADD CONSTRAINT kpi_indicators_pkey PRIMARY KEY (id);


--
-- Name: kpi_role_card_indicators kpi_role_card_indicators_pkey; Type: CONSTRAINT; Schema: public; Owner: kpi_user
--

ALTER TABLE ONLY public.kpi_role_card_indicators
    ADD CONSTRAINT kpi_role_card_indicators_pkey PRIMARY KEY (id);


--
-- Name: kpi_role_cards kpi_role_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: kpi_user
--

ALTER TABLE ONLY public.kpi_role_cards
    ADD CONSTRAINT kpi_role_cards_pkey PRIMARY KEY (id);


--
-- Name: kpi_submissions kpi_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: kpi_user
--

ALTER TABLE ONLY public.kpi_submissions
    ADD CONSTRAINT kpi_submissions_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_dedup_key_key; Type: CONSTRAINT; Schema: public; Owner: kpi_user
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_dedup_key_key UNIQUE (dedup_key);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: kpi_user
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: period_exceptions period_exceptions_pkey; Type: CONSTRAINT; Schema: public; Owner: kpi_user
--

ALTER TABLE ONLY public.period_exceptions
    ADD CONSTRAINT period_exceptions_pkey PRIMARY KEY (id);


--
-- Name: periods periods_pkey; Type: CONSTRAINT; Schema: public; Owner: kpi_user
--

ALTER TABLE ONLY public.periods
    ADD CONSTRAINT periods_pkey PRIMARY KEY (id);


--
-- Name: subordination subordination_pkey; Type: CONSTRAINT; Schema: public; Owner: kpi_user
--

ALTER TABLE ONLY public.subordination
    ADD CONSTRAINT subordination_pkey PRIMARY KEY (position_id);


--
-- Name: sync_log sync_log_pkey; Type: CONSTRAINT; Schema: public; Owner: kpi_user
--

ALTER TABLE ONLY public.sync_log
    ADD CONSTRAINT sync_log_pkey PRIMARY KEY (id);


--
-- Name: kpi_role_card_indicators uq_card_indicator; Type: CONSTRAINT; Schema: public; Owner: kpi_user
--

ALTER TABLE ONLY public.kpi_role_card_indicators
    ADD CONSTRAINT uq_card_indicator UNIQUE (card_id, indicator_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: kpi_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: ix_deputy_assignments_deputy_redmine_id; Type: INDEX; Schema: public; Owner: kpi_user
--

CREATE INDEX ix_deputy_assignments_deputy_redmine_id ON public.deputy_assignments USING btree (deputy_redmine_id);


--
-- Name: ix_deputy_assignments_manager_redmine_id; Type: INDEX; Schema: public; Owner: kpi_user
--

CREATE INDEX ix_deputy_assignments_manager_redmine_id ON public.deputy_assignments USING btree (manager_redmine_id);


--
-- Name: ix_employees_login; Type: INDEX; Schema: public; Owner: kpi_user
--

CREATE INDEX ix_employees_login ON public.employees USING btree (login);


--
-- Name: ix_employees_position_id; Type: INDEX; Schema: public; Owner: kpi_user
--

CREATE INDEX ix_employees_position_id ON public.employees USING btree (position_id);


--
-- Name: ix_employees_redmine_id; Type: INDEX; Schema: public; Owner: kpi_user
--

CREATE UNIQUE INDEX ix_employees_redmine_id ON public.employees USING btree (redmine_id);


--
-- Name: ix_kpi_change_requests_status; Type: INDEX; Schema: public; Owner: kpi_user
--

CREATE INDEX ix_kpi_change_requests_status ON public.kpi_change_requests USING btree (status);


--
-- Name: ix_kpi_criteria_indicator_id; Type: INDEX; Schema: public; Owner: kpi_user
--

CREATE INDEX ix_kpi_criteria_indicator_id ON public.kpi_criteria USING btree (indicator_id);


--
-- Name: ix_kpi_indicators_formula_type; Type: INDEX; Schema: public; Owner: kpi_user
--

CREATE INDEX ix_kpi_indicators_formula_type ON public.kpi_indicators USING btree (formula_type);


--
-- Name: ix_kpi_indicators_is_common; Type: INDEX; Schema: public; Owner: kpi_user
--

CREATE INDEX ix_kpi_indicators_is_common ON public.kpi_indicators USING btree (is_common);


--
-- Name: ix_kpi_indicators_status; Type: INDEX; Schema: public; Owner: kpi_user
--

CREATE INDEX ix_kpi_indicators_status ON public.kpi_indicators USING btree (status);


--
-- Name: ix_kpi_role_card_indicators_card_id; Type: INDEX; Schema: public; Owner: kpi_user
--

CREATE INDEX ix_kpi_role_card_indicators_card_id ON public.kpi_role_card_indicators USING btree (card_id);


--
-- Name: ix_kpi_role_cards_pos_id; Type: INDEX; Schema: public; Owner: kpi_user
--

CREATE INDEX ix_kpi_role_cards_pos_id ON public.kpi_role_cards USING btree (pos_id);


--
-- Name: ix_kpi_role_cards_role_id; Type: INDEX; Schema: public; Owner: kpi_user
--

CREATE INDEX ix_kpi_role_cards_role_id ON public.kpi_role_cards USING btree (role_id);


--
-- Name: ix_kpi_role_cards_status; Type: INDEX; Schema: public; Owner: kpi_user
--

CREATE INDEX ix_kpi_role_cards_status ON public.kpi_role_cards USING btree (status);


--
-- Name: ix_kpi_submissions_employee_redmine_id; Type: INDEX; Schema: public; Owner: kpi_user
--

CREATE INDEX ix_kpi_submissions_employee_redmine_id ON public.kpi_submissions USING btree (employee_redmine_id);


--
-- Name: ix_kpi_submissions_period_id; Type: INDEX; Schema: public; Owner: kpi_user
--

CREATE INDEX ix_kpi_submissions_period_id ON public.kpi_submissions USING btree (period_id);


--
-- Name: ix_notifications_dedup_key; Type: INDEX; Schema: public; Owner: kpi_user
--

CREATE INDEX ix_notifications_dedup_key ON public.notifications USING btree (dedup_key);


--
-- Name: ix_notifications_recipient_redmine_id; Type: INDEX; Schema: public; Owner: kpi_user
--

CREATE INDEX ix_notifications_recipient_redmine_id ON public.notifications USING btree (recipient_redmine_id);


--
-- Name: ix_period_exceptions_employee_redmine_id; Type: INDEX; Schema: public; Owner: kpi_user
--

CREATE INDEX ix_period_exceptions_employee_redmine_id ON public.period_exceptions USING btree (employee_redmine_id);


--
-- Name: ix_period_exceptions_period_id; Type: INDEX; Schema: public; Owner: kpi_user
--

CREATE INDEX ix_period_exceptions_period_id ON public.period_exceptions USING btree (period_id);


--
-- Name: ix_users_login; Type: INDEX; Schema: public; Owner: kpi_user
--

CREATE UNIQUE INDEX ix_users_login ON public.users USING btree (login);


--
-- Name: ix_users_redmine_id; Type: INDEX; Schema: public; Owner: kpi_user
--

CREATE UNIQUE INDEX ix_users_redmine_id ON public.users USING btree (redmine_id);


--
-- Name: kpi_criteria kpi_criteria_indicator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kpi_user
--

ALTER TABLE ONLY public.kpi_criteria
    ADD CONSTRAINT kpi_criteria_indicator_id_fkey FOREIGN KEY (indicator_id) REFERENCES public.kpi_indicators(id);


--
-- Name: kpi_role_card_indicators kpi_role_card_indicators_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kpi_user
--

ALTER TABLE ONLY public.kpi_role_card_indicators
    ADD CONSTRAINT kpi_role_card_indicators_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.kpi_role_cards(id) ON DELETE CASCADE;


--
-- Name: kpi_role_card_indicators kpi_role_card_indicators_criterion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kpi_user
--

ALTER TABLE ONLY public.kpi_role_card_indicators
    ADD CONSTRAINT kpi_role_card_indicators_criterion_id_fkey FOREIGN KEY (criterion_id) REFERENCES public.kpi_criteria(id);


--
-- Name: kpi_role_card_indicators kpi_role_card_indicators_indicator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kpi_user
--

ALTER TABLE ONLY public.kpi_role_card_indicators
    ADD CONSTRAINT kpi_role_card_indicators_indicator_id_fkey FOREIGN KEY (indicator_id) REFERENCES public.kpi_indicators(id);


--
-- PostgreSQL database dump complete
--

\unrestrict 70oYff2Nu5AQigISL1IZS34jdRpP0TmRbIeyCk6DHR7hMWgYH9mrZpt354j0q8S

