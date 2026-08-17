import { useQuery, useSuspenseQuery, useMutation } from "@tanstack/react-query";
import type { UseQueryOptions, UseSuspenseQueryOptions, UseMutationOptions } from "@tanstack/react-query";
export class ApiError extends Error {
    status: number;
    statusText: string;
    body: unknown;
    constructor(status: number, statusText: string, body: unknown){
        super(`HTTP ${status}: ${statusText}`);
        this.name = "ApiError";
        this.status = status;
        this.statusText = statusText;
        this.body = body;
    }
}
export interface AccountDetailOut {
    active_genie_spaces?: number;
    adoption?: AdoptionWorkflowOut | null;
    ae_owner: string;
    aim_status?: string;
    aim_ws_enabled?: number;
    arr?: number;
    created_at: string;
    dsa_owner: string;
    genie_active?: boolean;
    genie_dbu_series?: unknown[];
    genie_spend_90d?: number;
    id: string;
    issues?: AccountIssueOut[];
    monthly_dbus: number;
    name: string;
    open_blockers: number;
    plan?: AccountPlanItemOut[];
    pp_enforce?: string;
    pp_status?: string;
    provisioning_status?: string;
    provisioning_ws_enabled?: number;
    provisioning_ws_total?: number;
    readiness_pct?: number;
    readiness_tier?: string;
    sa_owner: string;
    security_blocker?: boolean;
    security_status?: string;
    sub_vertical: string;
    use_cases: UseCaseListOut[];
    ws_pp_off?: number;
    ws_pp_on?: number;
    ws_total?: number;
}
export interface AccountIn {
    ae_owner?: string;
    dsa_owner?: string;
    name: string;
    sa_owner?: string;
    sub_vertical?: string;
}
export interface AccountIssueOut {
    display_id: string;
    id: string;
    investigator: string;
    is_open: boolean;
    product_area: string;
    revenue_impact: number;
    severity: string;
    status: string;
    title: string;
}
export interface AccountOut {
    active_genie_spaces?: number;
    ae_owner: string;
    aim_status?: string;
    aim_ws_enabled?: number;
    arr?: number;
    created_at: string;
    dsa_owner?: string;
    genie_activated?: boolean;
    genie_active?: boolean;
    genie_dbu_series?: unknown[];
    genie_dbu_t28d?: number;
    genie_dbu_t7d?: number;
    genie_dbu_t90d?: number;
    genie_spend_90d?: number;
    id: string;
    monthly_dbus?: number;
    name: string;
    open_blockers?: number;
    open_issues?: number;
    pp_enforce?: string;
    pp_status?: string;
    provisioning_status?: string;
    provisioning_ws_enabled?: number;
    provisioning_ws_total?: number;
    readiness_pct?: number;
    readiness_tier?: string;
    sa_owner: string;
    sub_vertical: string;
    use_case_count?: number;
    vertical?: string;
    ws_pp_off?: number;
    ws_pp_on?: number;
    ws_total?: number;
}
export interface AccountPlanItemOut {
    applicable?: boolean;
    auto?: boolean;
    done?: boolean;
    group: string;
    group_name: string;
    has_note?: boolean;
    key: string;
    label: string;
    note?: string;
    reason?: string;
    status?: string;
}
export interface AccountPlanToggleIn {
    done?: boolean | null;
    item_key: string;
    note?: string | null;
}
export interface AdoptionBulkSaveIn {
    items: AdoptionTaskUpdateIn[];
}
export interface AdoptionHistoryEntryOut {
    changed_at: string;
    changed_by: string;
    note: string;
    status: string;
    task_key: string;
    task_label: string;
}
export interface AdoptionLaneOut {
    key: string;
    name: string;
    tone: string;
}
export interface AdoptionStageOut {
    code: string;
    key: string;
    name: string;
}
export interface AdoptionTaskOut {
    key: string;
    label: string;
    lane: string;
    note?: string;
    resources?: TaskResourceOut[];
    stage: string;
    status?: string;
}
export interface AdoptionTaskUpdateIn {
    note?: string | null;
    status?: string | null;
    task_key: string;
}
export interface AdoptionWorkflowOut {
    lanes: AdoptionLaneOut[];
    stages: AdoptionStageOut[];
    tasks: AdoptionTaskOut[];
}
export interface AudienceAccountOut {
    account_id: string;
    account_name: string;
    ae_email?: string;
    ae_owner?: string;
    arr?: number;
    dsa_email?: string;
    dsa_owner?: string;
    genie_spend_90d?: number;
    pp_status?: string;
    sa_email?: string;
    sa_owner?: string;
}
export interface AudienceFilters {
    arr_max?: number | null;
    arr_min?: number | null;
    genie_active?: boolean | null;
    genie_spend_max?: number | null;
    genie_spend_min?: number | null;
    has_use_case?: boolean | null;
    open_issues?: boolean | null;
    pp_enforce?: string | null;
    pp_status?: string | null;
    provisioning?: string | null;
    readiness_tier?: string | null;
    sub_vertical?: string | null;
    whitespace?: boolean | null;
}
export interface AudienceQueryIn {
    text: string;
}
export interface AudienceQueryOut {
    accounts: AudienceAccountOut[];
    filters: AudienceFilters;
    interpreted: string;
    sql?: string;
}
export interface BlockerAggOut {
    category_key: string;
    category_name: string;
    open_count: number;
    resolved_count: number;
}
export interface BlockerDefOut {
    action: string;
    checks: string[];
    concern: string;
    gate: string;
    key: string;
    name: string;
    resource_key: string;
    stage_hint: string;
}
export interface BlockerIn {
    category_key: string;
    note?: string;
}
export interface BlockerStateOut {
    category_key: string;
    category_name: string;
    created_at: string;
    id: string;
    note: string;
    resolved: boolean;
    stage: string;
}
export interface BrickroadIssueOut {
    account_id?: string;
    account_name?: string;
    display_id?: string;
    id: string;
    investigator?: string;
    product_area?: string;
    revenue_impact?: number;
    severity?: string;
    status?: string;
    title?: string;
}
export interface CampaignAccountOut {
    account_id: string;
    account_name: string;
    owners: string[];
}
export interface CampaignActivateIn {
    end_date?: string;
    start_date?: string;
}
export interface CampaignFormOut {
    accounts?: CampaignAccountOut[];
    campaign_id: string;
    end_date?: string;
    questions?: QuestionOut[];
    start_date?: string;
    status: string;
    title: string;
}
export interface CampaignIn {
    account_ids?: string[];
    audience_text?: string;
    end_date?: string;
    form_url?: string;
    start_date?: string;
    title: string;
}
export interface CampaignOut {
    account_count?: number;
    accounts?: CampaignAccountOut[];
    audience_text?: string;
    created_at: string;
    created_by?: string;
    end_date?: string;
    form_token?: string;
    form_url?: string;
    id: string;
    question_count?: number;
    response_count?: number;
    start_date?: string;
    status?: string;
    title: string;
}
export interface ChecklistItemOut {
    key: string;
    label: string;
    lane: string;
    stage: string;
}
export interface ChecklistStateOut {
    done: boolean;
    item_key: string;
    label: string;
    lane: string;
    stage: string;
}
export interface ChecklistToggleIn {
    done: boolean;
    item_key: string;
}
export interface ComplexValue {
    display?: string | null;
    primary?: boolean | null;
    ref?: string | null;
    type?: string | null;
    value?: string | null;
}
export interface DashboardOut {
    accounts_with_issues?: number;
    active_genie_spaces?: number;
    aim_off_accounts?: number;
    avg_readiness_pct?: number;
    blockers_by_category: BlockerAggOut[];
    brickroad_issues?: BrickroadIssueOut[];
    est_pipeline_per_month?: number;
    funnel: FunnelBucketOut[];
    genie_activated_accounts?: number;
    genie_active_accounts?: number;
    genie_ready_accounts?: GenieReadyAccountOut[];
    genie_revenue_t30d?: number;
    genie_spend_90d?: number;
    insights?: InsightOut[];
    issues_at_risk?: number;
    live_use_cases: number;
    open_blockers: number;
    open_issues?: number;
    pp_off_accounts?: number;
    pp_off_enforce_off?: number;
    pp_off_enforce_on?: number;
    pp_on_accounts?: number;
    spend_buckets?: SpendBucketOut[];
    stalled: StalledUseCaseOut[];
    sub_verticals?: SubVerticalStatOut[];
    tier_green?: number;
    tier_green_change_30d?: number;
    tier_red?: number;
    tier_red_change_30d?: number;
    tier_unknown?: number;
    tier_yellow?: number;
    tier_yellow_change_30d?: number;
    top_resources: TopResourceOut[];
    total_accounts: number;
    total_monthly_dbus?: number;
    total_revenue_impact?: number;
    total_use_cases: number;
    vertical_book_total?: number;
    whitespace_accounts?: number;
    whitespace_top?: WhitespaceAccountOut[];
    workspaces_with_genie?: number;
}
export interface FunnelBucketOut {
    code: string;
    count: number;
    monthly_dbus?: number;
    moved_in_30d?: number;
    moved_in_7d?: number;
    name: string;
    stage: string;
}
export interface GenieAnswerOut {
    columns?: string[];
    conversation_id: string;
    message_id: string;
    rows?: string[][];
    sql?: string | null;
    text: string;
}
export interface GenieAskIn {
    account_id?: string | null;
    conversation_id?: string | null;
    question: string;
}
export interface GenieHistoryEntryOut {
    account_id?: string | null;
    account_name?: string;
    answer: string;
    asked_by?: string;
    conversation_id: string;
    created_at: string;
    id: string;
    question: string;
}
export interface GenieReadyAccountOut {
    arr?: number;
    genie_dollars_t30d?: number;
    id: string;
    name: string;
    pp_status?: string;
    provisioning_status?: string;
    readiness_tier?: string;
    sub_vertical?: string;
}
export interface GenieStatusOut {
    enabled: boolean;
}
export interface HTTPValidationError {
    detail?: ValidationError[];
}
export interface InsightOut {
    filter_label?: string;
    filter_params?: Record<string, unknown>;
    text: string;
    tone?: string;
}
export interface Name {
    family_name?: string | null;
    given_name?: string | null;
}
export interface OkOut {
    ok?: boolean;
}
export interface PlaybookOut {
    blockers: BlockerDefOut[];
    checklist: ChecklistItemOut[];
    resources: ResourceOut[];
    stages: StageOut[];
    version: string;
}
export interface QuestionIn {
    options?: string[];
    prompt: string;
    qtype?: string;
    required?: boolean;
}
export interface QuestionOut {
    id: string;
    options?: string[];
    position: number;
    prompt: string;
    qtype: string;
    required?: boolean;
}
export interface QuestionnaireSaveIn {
    questions: QuestionIn[];
}
export interface ResourceClickIn {
    resource_key: string;
    stage?: string;
    use_case_id?: string | null;
}
export interface ResourceOut {
    bucket: string;
    key: string;
    label: string;
    stages: string[];
    url: string;
}
export interface ResponseOut {
    account_id?: string;
    account_name?: string;
    answers?: Record<string, unknown>;
    id: string;
    submitted_at: string;
    submitted_by?: string;
}
export interface ResponseSubmitIn {
    account_id?: string;
    account_name?: string;
    answers?: Record<string, unknown>;
}
export interface SpendBucketOut {
    account_count: number;
    label: string;
    order: number;
}
export interface StageAdvanceIn {
    to_stage: string;
}
export interface StageOut {
    code: string;
    key: string;
    name: string;
    order: number;
    summary: string;
}
export interface StalledUseCaseOut {
    account_name: string;
    days_since_update: number;
    id: string;
    stage: string;
    title: string;
}
export interface SubVerticalStatOut {
    accounts: number;
    arr?: number;
    avg_readiness_pct?: number;
    genie_active: number;
    genie_spend_90d?: number;
    sub_vertical: string;
    whitespace: number;
}
export interface TaskResourceOut {
    label: string;
    url: string;
}
export interface TopResourceOut {
    bucket: string;
    clicks: number;
    label: string;
    resource_key: string;
}
export interface UseCaseDetailOut {
    account_id: string;
    account_name: string;
    ae_owner?: string;
    blockers: BlockerStateOut[];
    checklist: ChecklistStateOut[];
    created_at: string;
    description: string;
    dsa_owner?: string;
    estimated_monthly_dbus: number;
    id: string;
    pp_enforce?: string;
    pp_status?: string;
    progress_pct: number;
    sa_owner?: string;
    stage: string;
    sub_vertical?: string;
    title: string;
    updated_at: string;
}
export interface UseCaseIn {
    account_id: string;
    description?: string;
    estimated_monthly_dbus?: number;
    title: string;
}
export interface UseCaseListOut {
    account_id: string;
    account_name: string;
    estimated_monthly_dbus?: number;
    id: string;
    open_blockers?: number;
    progress_pct?: number;
    stage: string;
    title: string;
    updated_at: string;
}
export interface User {
    active?: boolean | null;
    display_name?: string | null;
    emails?: ComplexValue[] | null;
    entitlements?: ComplexValue[] | null;
    external_id?: string | null;
    groups?: ComplexValue[] | null;
    id?: string | null;
    name?: Name | null;
    roles?: ComplexValue[] | null;
    schemas?: UserSchema[] | null;
    user_name?: string | null;
}
export const UserSchema = {
    "urn:ietf:params:scim:schemas:core:2.0:User": "urn:ietf:params:scim:schemas:core:2.0:User",
    "urn:ietf:params:scim:schemas:extension:workspace:2.0:User": "urn:ietf:params:scim:schemas:extension:workspace:2.0:User"
} as const;
export type UserSchema = typeof UserSchema[keyof typeof UserSchema];
export interface ValidationError {
    ctx?: Record<string, unknown>;
    input?: unknown;
    loc: (string | number)[];
    msg: string;
    type: string;
}
export interface VersionOut {
    version: string;
}
export interface WhitespaceAccountOut {
    ae_owner?: string;
    arr?: number;
    id: string;
    name: string;
    sub_vertical?: string;
}
export interface ListAccountsParams {
    q?: string;
    limit?: number;
    tier?: string;
    pp?: string;
    provisioning?: string;
    stage?: string;
    whitespace?: boolean;
    open_issues?: boolean;
    genie_active?: boolean;
    has_spend?: boolean;
    sub_vertical?: string;
    spend_bucket?: number;
    has_usecase?: boolean;
    vertical?: string;
    all?: boolean;
    genie_activated?: boolean;
    tier_moved_in?: string;
    tier_moved_out?: string;
}
export const listAccounts = async (params?: ListAccountsParams, options?: RequestInit): Promise<{
    data: AccountOut[];
}> =>{
    const searchParams = new URLSearchParams();
    if (params?.q != null) searchParams.set("q", String(params?.q));
    if (params?.limit != null) searchParams.set("limit", String(params?.limit));
    if (params?.tier != null) searchParams.set("tier", String(params?.tier));
    if (params?.pp != null) searchParams.set("pp", String(params?.pp));
    if (params?.provisioning != null) searchParams.set("provisioning", String(params?.provisioning));
    if (params?.stage != null) searchParams.set("stage", String(params?.stage));
    if (params?.whitespace != null) searchParams.set("whitespace", String(params?.whitespace));
    if (params?.open_issues != null) searchParams.set("open_issues", String(params?.open_issues));
    if (params?.genie_active != null) searchParams.set("genie_active", String(params?.genie_active));
    if (params?.has_spend != null) searchParams.set("has_spend", String(params?.has_spend));
    if (params?.sub_vertical != null) searchParams.set("sub_vertical", String(params?.sub_vertical));
    if (params?.spend_bucket != null) searchParams.set("spend_bucket", String(params?.spend_bucket));
    if (params?.has_usecase != null) searchParams.set("has_usecase", String(params?.has_usecase));
    if (params?.vertical != null) searchParams.set("vertical", String(params?.vertical));
    if (params?.all != null) searchParams.set("all", String(params?.all));
    if (params?.genie_activated != null) searchParams.set("genie_activated", String(params?.genie_activated));
    if (params?.tier_moved_in != null) searchParams.set("tier_moved_in", String(params?.tier_moved_in));
    if (params?.tier_moved_out != null) searchParams.set("tier_moved_out", String(params?.tier_moved_out));
    const queryString = searchParams.toString();
    const url = queryString ? `/api/accounts?${queryString}` : "/api/accounts";
    const res = await fetch(url, {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const listAccountsKey = (params?: ListAccountsParams)=>{
    return [
        "/api/accounts",
        params
    ] as const;
};
export function useListAccounts<TData = {
    data: AccountOut[];
}>(options?: {
    params?: ListAccountsParams;
    query?: Omit<UseQueryOptions<{
        data: AccountOut[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: listAccountsKey(options?.params),
        queryFn: ()=>listAccounts(options?.params),
        ...options?.query
    });
}
export function useListAccountsSuspense<TData = {
    data: AccountOut[];
}>(options?: {
    params?: ListAccountsParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: AccountOut[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: listAccountsKey(options?.params),
        queryFn: ()=>listAccounts(options?.params),
        ...options?.query
    });
}
export interface CreateAccountParams {
    "X-Forwarded-Host"?: string | null;
    "X-Forwarded-Preferred-Username"?: string | null;
    "X-Forwarded-User"?: string | null;
    "X-Forwarded-Email"?: string | null;
    "X-Request-Id"?: string | null;
    "X-Forwarded-Access-Token"?: string | null;
}
export const createAccount = async (data: AccountIn, params?: CreateAccountParams, options?: RequestInit): Promise<{
    data: AccountOut;
}> =>{
    const res = await fetch("/api/accounts", {
        ...options,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(params?.["X-Forwarded-Host"] != null && {
                "X-Forwarded-Host": params["X-Forwarded-Host"]
            }),
            ...(params?.["X-Forwarded-Preferred-Username"] != null && {
                "X-Forwarded-Preferred-Username": params["X-Forwarded-Preferred-Username"]
            }),
            ...(params?.["X-Forwarded-User"] != null && {
                "X-Forwarded-User": params["X-Forwarded-User"]
            }),
            ...(params?.["X-Forwarded-Email"] != null && {
                "X-Forwarded-Email": params["X-Forwarded-Email"]
            }),
            ...(params?.["X-Request-Id"] != null && {
                "X-Request-Id": params["X-Request-Id"]
            }),
            ...(params?.["X-Forwarded-Access-Token"] != null && {
                "X-Forwarded-Access-Token": params["X-Forwarded-Access-Token"]
            }),
            ...options?.headers
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useCreateAccount(options?: {
    mutation?: UseMutationOptions<{
        data: AccountOut;
    }, ApiError, {
        params: CreateAccountParams;
        data: AccountIn;
    }>;
}) {
    return useMutation({
        mutationFn: (vars)=>createAccount(vars.data, vars.params),
        ...options?.mutation
    });
}
export interface GetAccountParams {
    account_id: string;
}
export const getAccount = async (params: GetAccountParams, options?: RequestInit): Promise<{
    data: AccountDetailOut;
}> =>{
    const res = await fetch(`/api/accounts/${params.account_id}`, {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const getAccountKey = (params?: GetAccountParams)=>{
    return [
        "/api/accounts/{account_id}",
        params
    ] as const;
};
export function useGetAccount<TData = {
    data: AccountDetailOut;
}>(options: {
    params: GetAccountParams;
    query?: Omit<UseQueryOptions<{
        data: AccountDetailOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: getAccountKey(options.params),
        queryFn: ()=>getAccount(options.params),
        ...options?.query
    });
}
export function useGetAccountSuspense<TData = {
    data: AccountDetailOut;
}>(options: {
    params: GetAccountParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: AccountDetailOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: getAccountKey(options.params),
        queryFn: ()=>getAccount(options.params),
        ...options?.query
    });
}
export interface UpdateAdoptionTaskParams {
    account_id: string;
    "X-Forwarded-Host"?: string | null;
    "X-Forwarded-Preferred-Username"?: string | null;
    "X-Forwarded-User"?: string | null;
    "X-Forwarded-Email"?: string | null;
    "X-Request-Id"?: string | null;
    "X-Forwarded-Access-Token"?: string | null;
}
export const updateAdoptionTask = async (params: UpdateAdoptionTaskParams, data: AdoptionTaskUpdateIn, options?: RequestInit): Promise<{
    data: AccountDetailOut;
}> =>{
    const res = await fetch(`/api/accounts/${params.account_id}/adoption`, {
        ...options,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(params?.["X-Forwarded-Host"] != null && {
                "X-Forwarded-Host": params["X-Forwarded-Host"]
            }),
            ...(params?.["X-Forwarded-Preferred-Username"] != null && {
                "X-Forwarded-Preferred-Username": params["X-Forwarded-Preferred-Username"]
            }),
            ...(params?.["X-Forwarded-User"] != null && {
                "X-Forwarded-User": params["X-Forwarded-User"]
            }),
            ...(params?.["X-Forwarded-Email"] != null && {
                "X-Forwarded-Email": params["X-Forwarded-Email"]
            }),
            ...(params?.["X-Request-Id"] != null && {
                "X-Request-Id": params["X-Request-Id"]
            }),
            ...(params?.["X-Forwarded-Access-Token"] != null && {
                "X-Forwarded-Access-Token": params["X-Forwarded-Access-Token"]
            }),
            ...options?.headers
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useUpdateAdoptionTask(options?: {
    mutation?: UseMutationOptions<{
        data: AccountDetailOut;
    }, ApiError, {
        params: UpdateAdoptionTaskParams;
        data: AdoptionTaskUpdateIn;
    }>;
}) {
    return useMutation({
        mutationFn: (vars)=>updateAdoptionTask(vars.params, vars.data),
        ...options?.mutation
    });
}
export interface GetAdoptionHistoryParams {
    account_id: string;
}
export const getAdoptionHistory = async (params: GetAdoptionHistoryParams, options?: RequestInit): Promise<{
    data: AdoptionHistoryEntryOut[];
}> =>{
    const res = await fetch(`/api/accounts/${params.account_id}/adoption/history`, {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const getAdoptionHistoryKey = (params?: GetAdoptionHistoryParams)=>{
    return [
        "/api/accounts/{account_id}/adoption/history",
        params
    ] as const;
};
export function useGetAdoptionHistory<TData = {
    data: AdoptionHistoryEntryOut[];
}>(options: {
    params: GetAdoptionHistoryParams;
    query?: Omit<UseQueryOptions<{
        data: AdoptionHistoryEntryOut[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: getAdoptionHistoryKey(options.params),
        queryFn: ()=>getAdoptionHistory(options.params),
        ...options?.query
    });
}
export function useGetAdoptionHistorySuspense<TData = {
    data: AdoptionHistoryEntryOut[];
}>(options: {
    params: GetAdoptionHistoryParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: AdoptionHistoryEntryOut[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: getAdoptionHistoryKey(options.params),
        queryFn: ()=>getAdoptionHistory(options.params),
        ...options?.query
    });
}
export interface SaveAdoptionTasksParams {
    account_id: string;
    "X-Forwarded-Host"?: string | null;
    "X-Forwarded-Preferred-Username"?: string | null;
    "X-Forwarded-User"?: string | null;
    "X-Forwarded-Email"?: string | null;
    "X-Request-Id"?: string | null;
    "X-Forwarded-Access-Token"?: string | null;
}
export const saveAdoptionTasks = async (params: SaveAdoptionTasksParams, data: AdoptionBulkSaveIn, options?: RequestInit): Promise<{
    data: AccountDetailOut;
}> =>{
    const res = await fetch(`/api/accounts/${params.account_id}/adoption/save`, {
        ...options,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(params?.["X-Forwarded-Host"] != null && {
                "X-Forwarded-Host": params["X-Forwarded-Host"]
            }),
            ...(params?.["X-Forwarded-Preferred-Username"] != null && {
                "X-Forwarded-Preferred-Username": params["X-Forwarded-Preferred-Username"]
            }),
            ...(params?.["X-Forwarded-User"] != null && {
                "X-Forwarded-User": params["X-Forwarded-User"]
            }),
            ...(params?.["X-Forwarded-Email"] != null && {
                "X-Forwarded-Email": params["X-Forwarded-Email"]
            }),
            ...(params?.["X-Request-Id"] != null && {
                "X-Request-Id": params["X-Request-Id"]
            }),
            ...(params?.["X-Forwarded-Access-Token"] != null && {
                "X-Forwarded-Access-Token": params["X-Forwarded-Access-Token"]
            }),
            ...options?.headers
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useSaveAdoptionTasks(options?: {
    mutation?: UseMutationOptions<{
        data: AccountDetailOut;
    }, ApiError, {
        params: SaveAdoptionTasksParams;
        data: AdoptionBulkSaveIn;
    }>;
}) {
    return useMutation({
        mutationFn: (vars)=>saveAdoptionTasks(vars.params, vars.data),
        ...options?.mutation
    });
}
export interface ToggleAccountPlanItemParams {
    account_id: string;
    "X-Forwarded-Host"?: string | null;
    "X-Forwarded-Preferred-Username"?: string | null;
    "X-Forwarded-User"?: string | null;
    "X-Forwarded-Email"?: string | null;
    "X-Request-Id"?: string | null;
    "X-Forwarded-Access-Token"?: string | null;
}
export const toggleAccountPlanItem = async (params: ToggleAccountPlanItemParams, data: AccountPlanToggleIn, options?: RequestInit): Promise<{
    data: AccountDetailOut;
}> =>{
    const res = await fetch(`/api/accounts/${params.account_id}/plan`, {
        ...options,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(params?.["X-Forwarded-Host"] != null && {
                "X-Forwarded-Host": params["X-Forwarded-Host"]
            }),
            ...(params?.["X-Forwarded-Preferred-Username"] != null && {
                "X-Forwarded-Preferred-Username": params["X-Forwarded-Preferred-Username"]
            }),
            ...(params?.["X-Forwarded-User"] != null && {
                "X-Forwarded-User": params["X-Forwarded-User"]
            }),
            ...(params?.["X-Forwarded-Email"] != null && {
                "X-Forwarded-Email": params["X-Forwarded-Email"]
            }),
            ...(params?.["X-Request-Id"] != null && {
                "X-Request-Id": params["X-Request-Id"]
            }),
            ...(params?.["X-Forwarded-Access-Token"] != null && {
                "X-Forwarded-Access-Token": params["X-Forwarded-Access-Token"]
            }),
            ...options?.headers
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useToggleAccountPlanItem(options?: {
    mutation?: UseMutationOptions<{
        data: AccountDetailOut;
    }, ApiError, {
        params: ToggleAccountPlanItemParams;
        data: AccountPlanToggleIn;
    }>;
}) {
    return useMutation({
        mutationFn: (vars)=>toggleAccountPlanItem(vars.params, vars.data),
        ...options?.mutation
    });
}
export interface ResolveBlockerParams {
    blocker_id: string;
}
export const resolveBlocker = async (params: ResolveBlockerParams, options?: RequestInit): Promise<{
    data: UseCaseDetailOut;
}> =>{
    const res = await fetch(`/api/blockers/${params.blocker_id}/resolve`, {
        ...options,
        method: "POST"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useResolveBlocker(options?: {
    mutation?: UseMutationOptions<{
        data: UseCaseDetailOut;
    }, ApiError, {
        params: ResolveBlockerParams;
    }>;
}) {
    return useMutation({
        mutationFn: (vars)=>resolveBlocker(vars.params),
        ...options?.mutation
    });
}
export const listCampaigns = async (options?: RequestInit): Promise<{
    data: CampaignOut[];
}> =>{
    const res = await fetch("/api/campaigns", {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const listCampaignsKey = ()=>{
    return [
        "/api/campaigns"
    ] as const;
};
export function useListCampaigns<TData = {
    data: CampaignOut[];
}>(options?: {
    query?: Omit<UseQueryOptions<{
        data: CampaignOut[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: listCampaignsKey(),
        queryFn: ()=>listCampaigns(),
        ...options?.query
    });
}
export function useListCampaignsSuspense<TData = {
    data: CampaignOut[];
}>(options?: {
    query?: Omit<UseSuspenseQueryOptions<{
        data: CampaignOut[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: listCampaignsKey(),
        queryFn: ()=>listCampaigns(),
        ...options?.query
    });
}
export interface CreateCampaignParams {
    "X-Forwarded-Host"?: string | null;
    "X-Forwarded-Preferred-Username"?: string | null;
    "X-Forwarded-User"?: string | null;
    "X-Forwarded-Email"?: string | null;
    "X-Request-Id"?: string | null;
    "X-Forwarded-Access-Token"?: string | null;
}
export const createCampaign = async (data: CampaignIn, params?: CreateCampaignParams, options?: RequestInit): Promise<{
    data: CampaignOut;
}> =>{
    const res = await fetch("/api/campaigns", {
        ...options,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(params?.["X-Forwarded-Host"] != null && {
                "X-Forwarded-Host": params["X-Forwarded-Host"]
            }),
            ...(params?.["X-Forwarded-Preferred-Username"] != null && {
                "X-Forwarded-Preferred-Username": params["X-Forwarded-Preferred-Username"]
            }),
            ...(params?.["X-Forwarded-User"] != null && {
                "X-Forwarded-User": params["X-Forwarded-User"]
            }),
            ...(params?.["X-Forwarded-Email"] != null && {
                "X-Forwarded-Email": params["X-Forwarded-Email"]
            }),
            ...(params?.["X-Request-Id"] != null && {
                "X-Request-Id": params["X-Request-Id"]
            }),
            ...(params?.["X-Forwarded-Access-Token"] != null && {
                "X-Forwarded-Access-Token": params["X-Forwarded-Access-Token"]
            }),
            ...options?.headers
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useCreateCampaign(options?: {
    mutation?: UseMutationOptions<{
        data: CampaignOut;
    }, ApiError, {
        params: CreateCampaignParams;
        data: CampaignIn;
    }>;
}) {
    return useMutation({
        mutationFn: (vars)=>createCampaign(vars.data, vars.params),
        ...options?.mutation
    });
}
export const queryCampaignAudience = async (data: AudienceQueryIn, options?: RequestInit): Promise<{
    data: AudienceQueryOut;
}> =>{
    const res = await fetch("/api/campaigns/audience/query", {
        ...options,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...options?.headers
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useQueryCampaignAudience(options?: {
    mutation?: UseMutationOptions<{
        data: AudienceQueryOut;
    }, ApiError, AudienceQueryIn>;
}) {
    return useMutation({
        mutationFn: (data)=>queryCampaignAudience(data),
        ...options?.mutation
    });
}
export const seedDemoAccounts = async (options?: RequestInit): Promise<{
    data: unknown;
}> =>{
    const res = await fetch("/api/campaigns/audience/seed-demo", {
        ...options,
        method: "POST"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useSeedDemoAccounts(options?: {
    mutation?: UseMutationOptions<{
        data: unknown;
    }, ApiError, void>;
}) {
    return useMutation({
        mutationFn: ()=>seedDemoAccounts(),
        ...options?.mutation
    });
}
export interface GetCampaignParams {
    campaign_id: string;
}
export const getCampaign = async (params: GetCampaignParams, options?: RequestInit): Promise<{
    data: CampaignOut;
}> =>{
    const res = await fetch(`/api/campaigns/${params.campaign_id}`, {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const getCampaignKey = (params?: GetCampaignParams)=>{
    return [
        "/api/campaigns/{campaign_id}",
        params
    ] as const;
};
export function useGetCampaign<TData = {
    data: CampaignOut;
}>(options: {
    params: GetCampaignParams;
    query?: Omit<UseQueryOptions<{
        data: CampaignOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: getCampaignKey(options.params),
        queryFn: ()=>getCampaign(options.params),
        ...options?.query
    });
}
export function useGetCampaignSuspense<TData = {
    data: CampaignOut;
}>(options: {
    params: GetCampaignParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: CampaignOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: getCampaignKey(options.params),
        queryFn: ()=>getCampaign(options.params),
        ...options?.query
    });
}
export interface DeleteCampaignParams {
    campaign_id: string;
}
export const deleteCampaign = async (params: DeleteCampaignParams, options?: RequestInit): Promise<{
    data: unknown;
}> =>{
    const res = await fetch(`/api/campaigns/${params.campaign_id}`, {
        ...options,
        method: "DELETE"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useDeleteCampaign(options?: {
    mutation?: UseMutationOptions<{
        data: unknown;
    }, ApiError, {
        params: DeleteCampaignParams;
    }>;
}) {
    return useMutation({
        mutationFn: (vars)=>deleteCampaign(vars.params),
        ...options?.mutation
    });
}
export interface ActivateCampaignParams {
    campaign_id: string;
}
export const activateCampaign = async (params: ActivateCampaignParams, data: CampaignActivateIn, options?: RequestInit): Promise<{
    data: CampaignOut;
}> =>{
    const res = await fetch(`/api/campaigns/${params.campaign_id}/activate`, {
        ...options,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...options?.headers
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useActivateCampaign(options?: {
    mutation?: UseMutationOptions<{
        data: CampaignOut;
    }, ApiError, {
        params: ActivateCampaignParams;
        data: CampaignActivateIn;
    }>;
}) {
    return useMutation({
        mutationFn: (vars)=>activateCampaign(vars.params, vars.data),
        ...options?.mutation
    });
}
export interface CloseCampaignParams {
    campaign_id: string;
}
export const closeCampaign = async (params: CloseCampaignParams, options?: RequestInit): Promise<{
    data: CampaignOut;
}> =>{
    const res = await fetch(`/api/campaigns/${params.campaign_id}/close`, {
        ...options,
        method: "POST"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useCloseCampaign(options?: {
    mutation?: UseMutationOptions<{
        data: CampaignOut;
    }, ApiError, {
        params: CloseCampaignParams;
    }>;
}) {
    return useMutation({
        mutationFn: (vars)=>closeCampaign(vars.params),
        ...options?.mutation
    });
}
export interface ListCampaignQuestionsParams {
    campaign_id: string;
}
export const listCampaignQuestions = async (params: ListCampaignQuestionsParams, options?: RequestInit): Promise<{
    data: QuestionOut[];
}> =>{
    const res = await fetch(`/api/campaigns/${params.campaign_id}/questions`, {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const listCampaignQuestionsKey = (params?: ListCampaignQuestionsParams)=>{
    return [
        "/api/campaigns/{campaign_id}/questions",
        params
    ] as const;
};
export function useListCampaignQuestions<TData = {
    data: QuestionOut[];
}>(options: {
    params: ListCampaignQuestionsParams;
    query?: Omit<UseQueryOptions<{
        data: QuestionOut[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: listCampaignQuestionsKey(options.params),
        queryFn: ()=>listCampaignQuestions(options.params),
        ...options?.query
    });
}
export function useListCampaignQuestionsSuspense<TData = {
    data: QuestionOut[];
}>(options: {
    params: ListCampaignQuestionsParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: QuestionOut[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: listCampaignQuestionsKey(options.params),
        queryFn: ()=>listCampaignQuestions(options.params),
        ...options?.query
    });
}
export interface SaveCampaignQuestionsParams {
    campaign_id: string;
}
export const saveCampaignQuestions = async (params: SaveCampaignQuestionsParams, data: QuestionnaireSaveIn, options?: RequestInit): Promise<{
    data: QuestionOut[];
}> =>{
    const res = await fetch(`/api/campaigns/${params.campaign_id}/questions`, {
        ...options,
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            ...options?.headers
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useSaveCampaignQuestions(options?: {
    mutation?: UseMutationOptions<{
        data: QuestionOut[];
    }, ApiError, {
        params: SaveCampaignQuestionsParams;
        data: QuestionnaireSaveIn;
    }>;
}) {
    return useMutation({
        mutationFn: (vars)=>saveCampaignQuestions(vars.params, vars.data),
        ...options?.mutation
    });
}
export interface ListCampaignResponsesParams {
    campaign_id: string;
}
export const listCampaignResponses = async (params: ListCampaignResponsesParams, options?: RequestInit): Promise<{
    data: ResponseOut[];
}> =>{
    const res = await fetch(`/api/campaigns/${params.campaign_id}/responses`, {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const listCampaignResponsesKey = (params?: ListCampaignResponsesParams)=>{
    return [
        "/api/campaigns/{campaign_id}/responses",
        params
    ] as const;
};
export function useListCampaignResponses<TData = {
    data: ResponseOut[];
}>(options: {
    params: ListCampaignResponsesParams;
    query?: Omit<UseQueryOptions<{
        data: ResponseOut[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: listCampaignResponsesKey(options.params),
        queryFn: ()=>listCampaignResponses(options.params),
        ...options?.query
    });
}
export function useListCampaignResponsesSuspense<TData = {
    data: ResponseOut[];
}>(options: {
    params: ListCampaignResponsesParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: ResponseOut[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: listCampaignResponsesKey(options.params),
        queryFn: ()=>listCampaignResponses(options.params),
        ...options?.query
    });
}
export interface CurrentUserParams {
    "X-Forwarded-Host"?: string | null;
    "X-Forwarded-Preferred-Username"?: string | null;
    "X-Forwarded-User"?: string | null;
    "X-Forwarded-Email"?: string | null;
    "X-Request-Id"?: string | null;
    "X-Forwarded-Access-Token"?: string | null;
}
export const currentUser = async (params?: CurrentUserParams, options?: RequestInit): Promise<{
    data: User;
}> =>{
    const res = await fetch("/api/current-user", {
        ...options,
        method: "GET",
        headers: {
            ...(params?.["X-Forwarded-Host"] != null && {
                "X-Forwarded-Host": params["X-Forwarded-Host"]
            }),
            ...(params?.["X-Forwarded-Preferred-Username"] != null && {
                "X-Forwarded-Preferred-Username": params["X-Forwarded-Preferred-Username"]
            }),
            ...(params?.["X-Forwarded-User"] != null && {
                "X-Forwarded-User": params["X-Forwarded-User"]
            }),
            ...(params?.["X-Forwarded-Email"] != null && {
                "X-Forwarded-Email": params["X-Forwarded-Email"]
            }),
            ...(params?.["X-Request-Id"] != null && {
                "X-Request-Id": params["X-Request-Id"]
            }),
            ...(params?.["X-Forwarded-Access-Token"] != null && {
                "X-Forwarded-Access-Token": params["X-Forwarded-Access-Token"]
            }),
            ...options?.headers
        }
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const currentUserKey = (params?: CurrentUserParams)=>{
    return [
        "/api/current-user",
        params
    ] as const;
};
export function useCurrentUser<TData = {
    data: User;
}>(options?: {
    params?: CurrentUserParams;
    query?: Omit<UseQueryOptions<{
        data: User;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: currentUserKey(options?.params),
        queryFn: ()=>currentUser(options?.params),
        ...options?.query
    });
}
export function useCurrentUserSuspense<TData = {
    data: User;
}>(options?: {
    params?: CurrentUserParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: User;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: currentUserKey(options?.params),
        queryFn: ()=>currentUser(options?.params),
        ...options?.query
    });
}
export interface GetDashboardParams {
    vertical?: string;
}
export const getDashboard = async (params?: GetDashboardParams, options?: RequestInit): Promise<{
    data: DashboardOut;
}> =>{
    const searchParams = new URLSearchParams();
    if (params?.vertical != null) searchParams.set("vertical", String(params?.vertical));
    const queryString = searchParams.toString();
    const url = queryString ? `/api/dashboard?${queryString}` : "/api/dashboard";
    const res = await fetch(url, {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const getDashboardKey = (params?: GetDashboardParams)=>{
    return [
        "/api/dashboard",
        params
    ] as const;
};
export function useGetDashboard<TData = {
    data: DashboardOut;
}>(options?: {
    params?: GetDashboardParams;
    query?: Omit<UseQueryOptions<{
        data: DashboardOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: getDashboardKey(options?.params),
        queryFn: ()=>getDashboard(options?.params),
        ...options?.query
    });
}
export function useGetDashboardSuspense<TData = {
    data: DashboardOut;
}>(options?: {
    params?: GetDashboardParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: DashboardOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: getDashboardKey(options?.params),
        queryFn: ()=>getDashboard(options?.params),
        ...options?.query
    });
}
export interface GetCampaignFormParams {
    form_token: string;
}
export const getCampaignForm = async (params: GetCampaignFormParams, options?: RequestInit): Promise<{
    data: CampaignFormOut;
}> =>{
    const res = await fetch(`/api/forms/${params.form_token}`, {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const getCampaignFormKey = (params?: GetCampaignFormParams)=>{
    return [
        "/api/forms/{form_token}",
        params
    ] as const;
};
export function useGetCampaignForm<TData = {
    data: CampaignFormOut;
}>(options: {
    params: GetCampaignFormParams;
    query?: Omit<UseQueryOptions<{
        data: CampaignFormOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: getCampaignFormKey(options.params),
        queryFn: ()=>getCampaignForm(options.params),
        ...options?.query
    });
}
export function useGetCampaignFormSuspense<TData = {
    data: CampaignFormOut;
}>(options: {
    params: GetCampaignFormParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: CampaignFormOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: getCampaignFormKey(options.params),
        queryFn: ()=>getCampaignForm(options.params),
        ...options?.query
    });
}
export interface SubmitCampaignFormParams {
    form_token: string;
    "X-Forwarded-Host"?: string | null;
    "X-Forwarded-Preferred-Username"?: string | null;
    "X-Forwarded-User"?: string | null;
    "X-Forwarded-Email"?: string | null;
    "X-Request-Id"?: string | null;
    "X-Forwarded-Access-Token"?: string | null;
}
export const submitCampaignForm = async (params: SubmitCampaignFormParams, data: ResponseSubmitIn, options?: RequestInit): Promise<{
    data: ResponseOut;
}> =>{
    const res = await fetch(`/api/forms/${params.form_token}/submit`, {
        ...options,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(params?.["X-Forwarded-Host"] != null && {
                "X-Forwarded-Host": params["X-Forwarded-Host"]
            }),
            ...(params?.["X-Forwarded-Preferred-Username"] != null && {
                "X-Forwarded-Preferred-Username": params["X-Forwarded-Preferred-Username"]
            }),
            ...(params?.["X-Forwarded-User"] != null && {
                "X-Forwarded-User": params["X-Forwarded-User"]
            }),
            ...(params?.["X-Forwarded-Email"] != null && {
                "X-Forwarded-Email": params["X-Forwarded-Email"]
            }),
            ...(params?.["X-Request-Id"] != null && {
                "X-Request-Id": params["X-Request-Id"]
            }),
            ...(params?.["X-Forwarded-Access-Token"] != null && {
                "X-Forwarded-Access-Token": params["X-Forwarded-Access-Token"]
            }),
            ...options?.headers
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useSubmitCampaignForm(options?: {
    mutation?: UseMutationOptions<{
        data: ResponseOut;
    }, ApiError, {
        params: SubmitCampaignFormParams;
        data: ResponseSubmitIn;
    }>;
}) {
    return useMutation({
        mutationFn: (vars)=>submitCampaignForm(vars.params, vars.data),
        ...options?.mutation
    });
}
export interface AskGenieParams {
    "X-Forwarded-Host"?: string | null;
    "X-Forwarded-Preferred-Username"?: string | null;
    "X-Forwarded-User"?: string | null;
    "X-Forwarded-Email"?: string | null;
    "X-Request-Id"?: string | null;
    "X-Forwarded-Access-Token"?: string | null;
}
export const askGenie = async (data: GenieAskIn, params?: AskGenieParams, options?: RequestInit): Promise<{
    data: GenieAnswerOut;
}> =>{
    const res = await fetch("/api/genie/ask", {
        ...options,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(params?.["X-Forwarded-Host"] != null && {
                "X-Forwarded-Host": params["X-Forwarded-Host"]
            }),
            ...(params?.["X-Forwarded-Preferred-Username"] != null && {
                "X-Forwarded-Preferred-Username": params["X-Forwarded-Preferred-Username"]
            }),
            ...(params?.["X-Forwarded-User"] != null && {
                "X-Forwarded-User": params["X-Forwarded-User"]
            }),
            ...(params?.["X-Forwarded-Email"] != null && {
                "X-Forwarded-Email": params["X-Forwarded-Email"]
            }),
            ...(params?.["X-Request-Id"] != null && {
                "X-Request-Id": params["X-Request-Id"]
            }),
            ...(params?.["X-Forwarded-Access-Token"] != null && {
                "X-Forwarded-Access-Token": params["X-Forwarded-Access-Token"]
            }),
            ...options?.headers
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useAskGenie(options?: {
    mutation?: UseMutationOptions<{
        data: GenieAnswerOut;
    }, ApiError, {
        params: AskGenieParams;
        data: GenieAskIn;
    }>;
}) {
    return useMutation({
        mutationFn: (vars)=>askGenie(vars.data, vars.params),
        ...options?.mutation
    });
}
export interface AskGenieStreamParams {
    "X-Forwarded-Host"?: string | null;
    "X-Forwarded-Preferred-Username"?: string | null;
    "X-Forwarded-User"?: string | null;
    "X-Forwarded-Email"?: string | null;
    "X-Request-Id"?: string | null;
    "X-Forwarded-Access-Token"?: string | null;
}
export const askGenieStream = async (data: GenieAskIn, params?: AskGenieStreamParams, options?: RequestInit): Promise<{
    data: unknown;
}> =>{
    const res = await fetch("/api/genie/ask/stream", {
        ...options,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(params?.["X-Forwarded-Host"] != null && {
                "X-Forwarded-Host": params["X-Forwarded-Host"]
            }),
            ...(params?.["X-Forwarded-Preferred-Username"] != null && {
                "X-Forwarded-Preferred-Username": params["X-Forwarded-Preferred-Username"]
            }),
            ...(params?.["X-Forwarded-User"] != null && {
                "X-Forwarded-User": params["X-Forwarded-User"]
            }),
            ...(params?.["X-Forwarded-Email"] != null && {
                "X-Forwarded-Email": params["X-Forwarded-Email"]
            }),
            ...(params?.["X-Request-Id"] != null && {
                "X-Request-Id": params["X-Request-Id"]
            }),
            ...(params?.["X-Forwarded-Access-Token"] != null && {
                "X-Forwarded-Access-Token": params["X-Forwarded-Access-Token"]
            }),
            ...options?.headers
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useAskGenieStream(options?: {
    mutation?: UseMutationOptions<{
        data: unknown;
    }, ApiError, {
        params: AskGenieStreamParams;
        data: GenieAskIn;
    }>;
}) {
    return useMutation({
        mutationFn: (vars)=>askGenieStream(vars.data, vars.params),
        ...options?.mutation
    });
}
export interface GetGenieHistoryParams {
    conversation_id?: string;
    limit?: number;
}
export const getGenieHistory = async (params?: GetGenieHistoryParams, options?: RequestInit): Promise<{
    data: GenieHistoryEntryOut[];
}> =>{
    const searchParams = new URLSearchParams();
    if (params?.conversation_id != null) searchParams.set("conversation_id", String(params?.conversation_id));
    if (params?.limit != null) searchParams.set("limit", String(params?.limit));
    const queryString = searchParams.toString();
    const url = queryString ? `/api/genie/history?${queryString}` : "/api/genie/history";
    const res = await fetch(url, {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const getGenieHistoryKey = (params?: GetGenieHistoryParams)=>{
    return [
        "/api/genie/history",
        params
    ] as const;
};
export function useGetGenieHistory<TData = {
    data: GenieHistoryEntryOut[];
}>(options?: {
    params?: GetGenieHistoryParams;
    query?: Omit<UseQueryOptions<{
        data: GenieHistoryEntryOut[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: getGenieHistoryKey(options?.params),
        queryFn: ()=>getGenieHistory(options?.params),
        ...options?.query
    });
}
export function useGetGenieHistorySuspense<TData = {
    data: GenieHistoryEntryOut[];
}>(options?: {
    params?: GetGenieHistoryParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: GenieHistoryEntryOut[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: getGenieHistoryKey(options?.params),
        queryFn: ()=>getGenieHistory(options?.params),
        ...options?.query
    });
}
export const getGenieStatus = async (options?: RequestInit): Promise<{
    data: GenieStatusOut;
}> =>{
    const res = await fetch("/api/genie/status", {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const getGenieStatusKey = ()=>{
    return [
        "/api/genie/status"
    ] as const;
};
export function useGetGenieStatus<TData = {
    data: GenieStatusOut;
}>(options?: {
    query?: Omit<UseQueryOptions<{
        data: GenieStatusOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: getGenieStatusKey(),
        queryFn: ()=>getGenieStatus(),
        ...options?.query
    });
}
export function useGetGenieStatusSuspense<TData = {
    data: GenieStatusOut;
}>(options?: {
    query?: Omit<UseSuspenseQueryOptions<{
        data: GenieStatusOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: getGenieStatusKey(),
        queryFn: ()=>getGenieStatus(),
        ...options?.query
    });
}
export const getPlaybook = async (options?: RequestInit): Promise<{
    data: PlaybookOut;
}> =>{
    const res = await fetch("/api/playbook", {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const getPlaybookKey = ()=>{
    return [
        "/api/playbook"
    ] as const;
};
export function useGetPlaybook<TData = {
    data: PlaybookOut;
}>(options?: {
    query?: Omit<UseQueryOptions<{
        data: PlaybookOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: getPlaybookKey(),
        queryFn: ()=>getPlaybook(),
        ...options?.query
    });
}
export function useGetPlaybookSuspense<TData = {
    data: PlaybookOut;
}>(options?: {
    query?: Omit<UseSuspenseQueryOptions<{
        data: PlaybookOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: getPlaybookKey(),
        queryFn: ()=>getPlaybook(),
        ...options?.query
    });
}
export interface LogResourceClickParams {
    "X-Forwarded-Host"?: string | null;
    "X-Forwarded-Preferred-Username"?: string | null;
    "X-Forwarded-User"?: string | null;
    "X-Forwarded-Email"?: string | null;
    "X-Request-Id"?: string | null;
    "X-Forwarded-Access-Token"?: string | null;
}
export const logResourceClick = async (data: ResourceClickIn, params?: LogResourceClickParams, options?: RequestInit): Promise<{
    data: OkOut;
}> =>{
    const res = await fetch("/api/resource-clicks", {
        ...options,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(params?.["X-Forwarded-Host"] != null && {
                "X-Forwarded-Host": params["X-Forwarded-Host"]
            }),
            ...(params?.["X-Forwarded-Preferred-Username"] != null && {
                "X-Forwarded-Preferred-Username": params["X-Forwarded-Preferred-Username"]
            }),
            ...(params?.["X-Forwarded-User"] != null && {
                "X-Forwarded-User": params["X-Forwarded-User"]
            }),
            ...(params?.["X-Forwarded-Email"] != null && {
                "X-Forwarded-Email": params["X-Forwarded-Email"]
            }),
            ...(params?.["X-Request-Id"] != null && {
                "X-Request-Id": params["X-Request-Id"]
            }),
            ...(params?.["X-Forwarded-Access-Token"] != null && {
                "X-Forwarded-Access-Token": params["X-Forwarded-Access-Token"]
            }),
            ...options?.headers
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useLogResourceClick(options?: {
    mutation?: UseMutationOptions<{
        data: OkOut;
    }, ApiError, {
        params: LogResourceClickParams;
        data: ResourceClickIn;
    }>;
}) {
    return useMutation({
        mutationFn: (vars)=>logResourceClick(vars.data, vars.params),
        ...options?.mutation
    });
}
export const listUseCases = async (options?: RequestInit): Promise<{
    data: UseCaseListOut[];
}> =>{
    const res = await fetch("/api/use-cases", {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const listUseCasesKey = ()=>{
    return [
        "/api/use-cases"
    ] as const;
};
export function useListUseCases<TData = {
    data: UseCaseListOut[];
}>(options?: {
    query?: Omit<UseQueryOptions<{
        data: UseCaseListOut[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: listUseCasesKey(),
        queryFn: ()=>listUseCases(),
        ...options?.query
    });
}
export function useListUseCasesSuspense<TData = {
    data: UseCaseListOut[];
}>(options?: {
    query?: Omit<UseSuspenseQueryOptions<{
        data: UseCaseListOut[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: listUseCasesKey(),
        queryFn: ()=>listUseCases(),
        ...options?.query
    });
}
export interface CreateUseCaseParams {
    "X-Forwarded-Host"?: string | null;
    "X-Forwarded-Preferred-Username"?: string | null;
    "X-Forwarded-User"?: string | null;
    "X-Forwarded-Email"?: string | null;
    "X-Request-Id"?: string | null;
    "X-Forwarded-Access-Token"?: string | null;
}
export const createUseCase = async (data: UseCaseIn, params?: CreateUseCaseParams, options?: RequestInit): Promise<{
    data: UseCaseDetailOut;
}> =>{
    const res = await fetch("/api/use-cases", {
        ...options,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(params?.["X-Forwarded-Host"] != null && {
                "X-Forwarded-Host": params["X-Forwarded-Host"]
            }),
            ...(params?.["X-Forwarded-Preferred-Username"] != null && {
                "X-Forwarded-Preferred-Username": params["X-Forwarded-Preferred-Username"]
            }),
            ...(params?.["X-Forwarded-User"] != null && {
                "X-Forwarded-User": params["X-Forwarded-User"]
            }),
            ...(params?.["X-Forwarded-Email"] != null && {
                "X-Forwarded-Email": params["X-Forwarded-Email"]
            }),
            ...(params?.["X-Request-Id"] != null && {
                "X-Request-Id": params["X-Request-Id"]
            }),
            ...(params?.["X-Forwarded-Access-Token"] != null && {
                "X-Forwarded-Access-Token": params["X-Forwarded-Access-Token"]
            }),
            ...options?.headers
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useCreateUseCase(options?: {
    mutation?: UseMutationOptions<{
        data: UseCaseDetailOut;
    }, ApiError, {
        params: CreateUseCaseParams;
        data: UseCaseIn;
    }>;
}) {
    return useMutation({
        mutationFn: (vars)=>createUseCase(vars.data, vars.params),
        ...options?.mutation
    });
}
export interface GetUseCaseParams {
    use_case_id: string;
}
export const getUseCase = async (params: GetUseCaseParams, options?: RequestInit): Promise<{
    data: UseCaseDetailOut;
}> =>{
    const res = await fetch(`/api/use-cases/${params.use_case_id}`, {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const getUseCaseKey = (params?: GetUseCaseParams)=>{
    return [
        "/api/use-cases/{use_case_id}",
        params
    ] as const;
};
export function useGetUseCase<TData = {
    data: UseCaseDetailOut;
}>(options: {
    params: GetUseCaseParams;
    query?: Omit<UseQueryOptions<{
        data: UseCaseDetailOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: getUseCaseKey(options.params),
        queryFn: ()=>getUseCase(options.params),
        ...options?.query
    });
}
export function useGetUseCaseSuspense<TData = {
    data: UseCaseDetailOut;
}>(options: {
    params: GetUseCaseParams;
    query?: Omit<UseSuspenseQueryOptions<{
        data: UseCaseDetailOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: getUseCaseKey(options.params),
        queryFn: ()=>getUseCase(options.params),
        ...options?.query
    });
}
export interface FlagBlockerParams {
    use_case_id: string;
    "X-Forwarded-Host"?: string | null;
    "X-Forwarded-Preferred-Username"?: string | null;
    "X-Forwarded-User"?: string | null;
    "X-Forwarded-Email"?: string | null;
    "X-Request-Id"?: string | null;
    "X-Forwarded-Access-Token"?: string | null;
}
export const flagBlocker = async (params: FlagBlockerParams, data: BlockerIn, options?: RequestInit): Promise<{
    data: UseCaseDetailOut;
}> =>{
    const res = await fetch(`/api/use-cases/${params.use_case_id}/blockers`, {
        ...options,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(params?.["X-Forwarded-Host"] != null && {
                "X-Forwarded-Host": params["X-Forwarded-Host"]
            }),
            ...(params?.["X-Forwarded-Preferred-Username"] != null && {
                "X-Forwarded-Preferred-Username": params["X-Forwarded-Preferred-Username"]
            }),
            ...(params?.["X-Forwarded-User"] != null && {
                "X-Forwarded-User": params["X-Forwarded-User"]
            }),
            ...(params?.["X-Forwarded-Email"] != null && {
                "X-Forwarded-Email": params["X-Forwarded-Email"]
            }),
            ...(params?.["X-Request-Id"] != null && {
                "X-Request-Id": params["X-Request-Id"]
            }),
            ...(params?.["X-Forwarded-Access-Token"] != null && {
                "X-Forwarded-Access-Token": params["X-Forwarded-Access-Token"]
            }),
            ...options?.headers
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useFlagBlocker(options?: {
    mutation?: UseMutationOptions<{
        data: UseCaseDetailOut;
    }, ApiError, {
        params: FlagBlockerParams;
        data: BlockerIn;
    }>;
}) {
    return useMutation({
        mutationFn: (vars)=>flagBlocker(vars.params, vars.data),
        ...options?.mutation
    });
}
export interface ToggleChecklistItemParams {
    use_case_id: string;
    "X-Forwarded-Host"?: string | null;
    "X-Forwarded-Preferred-Username"?: string | null;
    "X-Forwarded-User"?: string | null;
    "X-Forwarded-Email"?: string | null;
    "X-Request-Id"?: string | null;
    "X-Forwarded-Access-Token"?: string | null;
}
export const toggleChecklistItem = async (params: ToggleChecklistItemParams, data: ChecklistToggleIn, options?: RequestInit): Promise<{
    data: UseCaseDetailOut;
}> =>{
    const res = await fetch(`/api/use-cases/${params.use_case_id}/checklist`, {
        ...options,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(params?.["X-Forwarded-Host"] != null && {
                "X-Forwarded-Host": params["X-Forwarded-Host"]
            }),
            ...(params?.["X-Forwarded-Preferred-Username"] != null && {
                "X-Forwarded-Preferred-Username": params["X-Forwarded-Preferred-Username"]
            }),
            ...(params?.["X-Forwarded-User"] != null && {
                "X-Forwarded-User": params["X-Forwarded-User"]
            }),
            ...(params?.["X-Forwarded-Email"] != null && {
                "X-Forwarded-Email": params["X-Forwarded-Email"]
            }),
            ...(params?.["X-Request-Id"] != null && {
                "X-Request-Id": params["X-Request-Id"]
            }),
            ...(params?.["X-Forwarded-Access-Token"] != null && {
                "X-Forwarded-Access-Token": params["X-Forwarded-Access-Token"]
            }),
            ...options?.headers
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useToggleChecklistItem(options?: {
    mutation?: UseMutationOptions<{
        data: UseCaseDetailOut;
    }, ApiError, {
        params: ToggleChecklistItemParams;
        data: ChecklistToggleIn;
    }>;
}) {
    return useMutation({
        mutationFn: (vars)=>toggleChecklistItem(vars.params, vars.data),
        ...options?.mutation
    });
}
export interface AdvanceStageParams {
    use_case_id: string;
    "X-Forwarded-Host"?: string | null;
    "X-Forwarded-Preferred-Username"?: string | null;
    "X-Forwarded-User"?: string | null;
    "X-Forwarded-Email"?: string | null;
    "X-Request-Id"?: string | null;
    "X-Forwarded-Access-Token"?: string | null;
}
export const advanceStage = async (params: AdvanceStageParams, data: StageAdvanceIn, options?: RequestInit): Promise<{
    data: UseCaseDetailOut;
}> =>{
    const res = await fetch(`/api/use-cases/${params.use_case_id}/stage`, {
        ...options,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(params?.["X-Forwarded-Host"] != null && {
                "X-Forwarded-Host": params["X-Forwarded-Host"]
            }),
            ...(params?.["X-Forwarded-Preferred-Username"] != null && {
                "X-Forwarded-Preferred-Username": params["X-Forwarded-Preferred-Username"]
            }),
            ...(params?.["X-Forwarded-User"] != null && {
                "X-Forwarded-User": params["X-Forwarded-User"]
            }),
            ...(params?.["X-Forwarded-Email"] != null && {
                "X-Forwarded-Email": params["X-Forwarded-Email"]
            }),
            ...(params?.["X-Request-Id"] != null && {
                "X-Request-Id": params["X-Request-Id"]
            }),
            ...(params?.["X-Forwarded-Access-Token"] != null && {
                "X-Forwarded-Access-Token": params["X-Forwarded-Access-Token"]
            }),
            ...options?.headers
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export function useAdvanceStage(options?: {
    mutation?: UseMutationOptions<{
        data: UseCaseDetailOut;
    }, ApiError, {
        params: AdvanceStageParams;
        data: StageAdvanceIn;
    }>;
}) {
    return useMutation({
        mutationFn: (vars)=>advanceStage(vars.params, vars.data),
        ...options?.mutation
    });
}
export const version = async (options?: RequestInit): Promise<{
    data: VersionOut;
}> =>{
    const res = await fetch("/api/version", {
        ...options,
        method: "GET"
    });
    if (!res.ok) {
        const body = await res.text();
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch  {
            parsed = body;
        }
        throw new ApiError(res.status, res.statusText, parsed);
    }
    return {
        data: await res.json()
    };
};
export const versionKey = ()=>{
    return [
        "/api/version"
    ] as const;
};
export function useVersion<TData = {
    data: VersionOut;
}>(options?: {
    query?: Omit<UseQueryOptions<{
        data: VersionOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: versionKey(),
        queryFn: ()=>version(),
        ...options?.query
    });
}
export function useVersionSuspense<TData = {
    data: VersionOut;
}>(options?: {
    query?: Omit<UseSuspenseQueryOptions<{
        data: VersionOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: versionKey(),
        queryFn: ()=>version(),
        ...options?.query
    });
}
