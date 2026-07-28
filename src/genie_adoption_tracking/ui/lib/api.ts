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
    adoption?: AdoptionWorkflowOut | null;
    ae_owner: string;
    aim_status?: string;
    aim_ws_enabled?: number;
    arr?: number;
    created_at: string;
    dsa_owner: string;
    genie_active?: boolean;
    id: string;
    issues?: AccountIssueOut[];
    monthly_dbus: number;
    name: string;
    open_blockers: number;
    plan?: AccountPlanItemOut[];
    pp_enforce?: string;
    pp_status?: string;
    readiness_pct?: number;
    sa_owner: string;
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
    ae_owner: string;
    aim_status?: string;
    aim_ws_enabled?: number;
    arr?: number;
    created_at: string;
    dsa_owner?: string;
    genie_active?: boolean;
    id: string;
    monthly_dbus?: number;
    name: string;
    open_blockers?: number;
    open_issues?: number;
    pp_enforce?: string;
    pp_status?: string;
    readiness_pct?: number;
    sa_owner: string;
    sub_vertical: string;
    use_case_count?: number;
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
    aim_off_accounts?: number;
    avg_readiness_pct?: number;
    blockers_by_category: BlockerAggOut[];
    funnel: FunnelBucketOut[];
    live_use_cases: number;
    open_blockers: number;
    open_issues?: number;
    pp_off_accounts?: number;
    stalled: StalledUseCaseOut[];
    top_resources: TopResourceOut[];
    total_accounts: number;
    total_monthly_dbus?: number;
    total_use_cases: number;
}
export interface FunnelBucketOut {
    code: string;
    count: number;
    monthly_dbus?: number;
    name: string;
    stage: string;
}
export interface HTTPValidationError {
    detail?: ValidationError[];
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
export const listAccounts = async (options?: RequestInit): Promise<{
    data: AccountOut[];
}> =>{
    const res = await fetch("/api/accounts", {
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
export const listAccountsKey = ()=>{
    return [
        "/api/accounts"
    ] as const;
};
export function useListAccounts<TData = {
    data: AccountOut[];
}>(options?: {
    query?: Omit<UseQueryOptions<{
        data: AccountOut[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: listAccountsKey(),
        queryFn: ()=>listAccounts(),
        ...options?.query
    });
}
export function useListAccountsSuspense<TData = {
    data: AccountOut[];
}>(options?: {
    query?: Omit<UseSuspenseQueryOptions<{
        data: AccountOut[];
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: listAccountsKey(),
        queryFn: ()=>listAccounts(),
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
export const getDashboard = async (options?: RequestInit): Promise<{
    data: DashboardOut;
}> =>{
    const res = await fetch("/api/dashboard", {
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
export const getDashboardKey = ()=>{
    return [
        "/api/dashboard"
    ] as const;
};
export function useGetDashboard<TData = {
    data: DashboardOut;
}>(options?: {
    query?: Omit<UseQueryOptions<{
        data: DashboardOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useQuery({
        queryKey: getDashboardKey(),
        queryFn: ()=>getDashboard(),
        ...options?.query
    });
}
export function useGetDashboardSuspense<TData = {
    data: DashboardOut;
}>(options?: {
    query?: Omit<UseSuspenseQueryOptions<{
        data: DashboardOut;
    }, ApiError, TData>, "queryKey" | "queryFn">;
}) {
    return useSuspenseQuery({
        queryKey: getDashboardKey(),
        queryFn: ()=>getDashboard(),
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
