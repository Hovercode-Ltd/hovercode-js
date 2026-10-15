/**
 * Client for the Hovercode REST API (https://hovercode.com/api/): dynamic QR codes
 * whose destination can be changed after printing, scan tracking and analytics,
 * short links, PDF codes, landing pages, forms and webhooks.
 *
 * Server-side only: the API token would be exposed in a browser.
 */

export const DEFAULT_BASE_URL = 'https://hovercode.com';

export type QRType = 'Link' | 'Text' | 'vCard' | 'GS1';
export type Pattern = 'Original' | 'Circles' | 'Squares' | 'Diamonds' | 'Triangles';
export type ApiEyeStyle = 'Square' | 'Rounded' | 'Drop' | 'Leaf';
export type Frame =
  | 'border'
  | 'border-small'
  | 'border-large'
  | 'square'
  | 'speech-bubble'
  | 'speech-bubble-above'
  | 'card'
  | 'card-above'
  | 'text-frame'
  | 'round-frame'
  | 'circle-viewfinder'
  | 'solid-spin'
  | 'burst'
  | 'scattered-lines'
  | 'polkadot'
  | 'swirl';

export interface Design {
  primary_color?: string;
  eye_color?: string;
  background_color?: string;
  pattern?: Pattern;
  eye_style?: ApiEyeStyle;
  frame?: Frame;
  frame_color?: string;
  has_border?: boolean;
  text?: string;
  error_correction?: 'L' | 'M' | 'Q' | 'H';
  logo_url?: string;
  logo_round?: boolean;
}

export interface DesignUpdate extends Design {
  text_secondary?: string;
  logo_base64?: string;
  remove_logo?: boolean;
}

export interface VCard {
  first_name: string;
  last_name?: string;
  company_name?: string;
  position?: string;
  email?: string;
  mobile_number?: string;
  phone_number?: string;
  website?: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  post_code?: string;
  description?: string;
}

export interface CreateCodeParams extends Design {
  /** Defaults to the client's workspace. */
  workspace?: string;
  /** A URL for `Link` codes, any text for `Text` codes. */
  qr_data?: string;
  qr_type?: QRType;
  /** Defaults to false in the raw API. Dynamic codes can be edited and are tracked. */
  dynamic?: boolean;
  display_name?: string;
  domain?: string;
  generate_png?: boolean;
  gps_tracking?: boolean;
  size?: number;
  folder?: string;
  template?: string;
  vcard?: VCard;
  gs1_product?: string | { identifier_value: string; destination_url: string; [key: string]: unknown };
}

export interface Folder {
  id: string;
  name: string;
  slug: string;
  path: string;
  parent?: string | null;
  code_count?: number;
  created?: string;
}

export interface QRCodeRecord {
  id: string;
  qr_data?: string;
  qr_type: QRType;
  display_name: string | null;
  /** The tracked short link a dynamic code encodes; null for static codes. */
  shortlink_url: string | null;
  dynamic: boolean;
  svg?: string;
  svg_file?: string | null;
  png?: string | null;
  created: string;
  folder?: Pick<Folder, 'id' | 'name' | 'slug' | 'path'> | null;
  total_scans?: number | null;
  unique_scans?: number | null;
  tags?: Tag[];
  [key: string]: unknown;
}

export interface Tag {
  id: string;
  title: string;
  slug: string;
}

export interface Workspace {
  id: string;
  name: string;
  /** The account's current (most recently used) workspace. */
  current: boolean;
  plan: string;
  paid: boolean;
  dynamic_qr_used: number | null;
  dynamic_qr_limit: number | null;
  pages_used?: number | null;
}

export interface Page<T> {
  count: number;
  next: string | null;
  previous?: string | null;
  results: T[];
}

export interface WorkspacePage extends Page<Workspace> {
  /** The account's current (most recently used) workspace. */
  current_workspace: string | null;
}

export interface ListCodesParams {
  q?: string;
  folder?: string;
  subfolders?: boolean;
  /** `scans` adds total_scans/unique_scans, `tags` adds each code's tags. */
  include?: Array<'scans' | 'tags'>;
  days?: number;
  start?: string;
  end?: string;
  page?: number;
  page_size?: number;
}

export interface PeriodParams {
  /** Last N days (up to 365). Defaults to 30. */
  days?: number;
  start?: string;
  end?: string;
}

export interface Analytics {
  total_scans: number;
  unique_scans: number;
  scans_by_day: Array<{ date: string; scans: number; [key: string]: unknown }>;
  top_countries: unknown[];
  top_cities: unknown[];
  top_os: unknown[];
  top_browsers: unknown[];
  top_codes?: unknown[];
  [key: string]: unknown;
}

export interface Scan {
  id: string;
  qr_code_id: string;
  time_utc: string;
  time_timezone_aware: string;
  location: string | null;
  device: string | null;
  scanner_id: string;
}

export interface CreateLinkParams {
  workspace?: string;
  link: string;
  slug?: string;
  domain?: string;
  display_name?: string;
  gps?: boolean;
}

export interface CreatePdfParams {
  workspace?: string;
  pdf_url?: string;
  pdf_base64?: string;
  filename?: string;
  display_name?: string;
  domain?: string;
}

export interface CreatePageParams {
  workspace?: string;
  title: string;
  links?: Array<{ url: string; title?: string; type?: string }>;
  description?: string;
  bg_color?: string;
  text_color?: string;
  domain?: string;
  slug?: string;
}

export interface HovercodeOptions {
  /** API token. Defaults to the HOVERCODE_API_TOKEN environment variable. */
  token?: string;
  /**
   * Workspace ID, used by create calls and listings. Defaults to HOVERCODE_WORKSPACE_ID,
   * else the token's current workspace (looked up on first use).
   */
  workspace?: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  /** Per-request timeout. Defaults to 30s. */
  timeoutMs?: number;
  /** Retries after a 429, honouring Retry-After. Defaults to 2. */
  maxRetries?: number;
  /** The token would be visible to anyone using the page. Only set this for local tools you alone run. */
  dangerouslyAllowBrowser?: boolean;
}

export interface RequestOptions {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
}

export class HovercodeError extends Error {
  /** HTTP status, or 0 when no request was made (missing credentials, timeout). */
  readonly status: number;
  readonly body: unknown;
  readonly retryAfter?: number;
  /** `missing_credentials` (a config problem: no request was sent), `timeout`, `rate_limited`, or `http_error`. */
  readonly code: 'missing_credentials' | 'timeout' | 'rate_limited' | 'http_error';

  constructor(
    message: string,
    status: number,
    body: unknown,
    retryAfter?: number,
    code?: HovercodeError['code'],
  ) {
    super(message);
    this.name = 'HovercodeError';
    this.status = status;
    this.body = body;
    this.retryAfter = retryAfter;
    this.code = code ?? (status === 429 ? 'rate_limited' : 'http_error');
  }
}

function env(name: string): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc?.env?.[name] || undefined;
}

function errorMessage(status: number, body: unknown): string {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    const err = b.error ?? b.detail;
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string') {
      return (err as { message: string }).message;
    }
    return JSON.stringify(err ?? body);
  }
  if (typeof body === 'string' && body) return body.slice(0, 300);
  return `HTTP ${status}`;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class Hovercode {
  readonly baseUrl: string;
  readonly workspace?: string;
  private readonly token?: string;
  private currentWorkspace?: Promise<string>;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(options: HovercodeOptions = {}) {
    const isBrowser = typeof (globalThis as { document?: unknown }).document !== 'undefined';
    if (isBrowser && !options.dangerouslyAllowBrowser) {
      throw new Error(
        'The Hovercode client must run on a server: in a browser your API token would be public. ' +
          'Static codes (toSVG, toDataURL) work in the browser without a token.',
      );
    }
    this.token = options.token ?? env('HOVERCODE_API_TOKEN');
    this.workspace = options.workspace ?? env('HOVERCODE_WORKSPACE_ID');
    this.baseUrl = (options.baseUrl ?? env('HOVERCODE_BASE_URL') ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.maxRetries = options.maxRetries ?? 2;
  }

  /** Call any API endpoint. `path` is relative to the base URL (e.g. `/api/v2/...`) or absolute. */
  async request<T = unknown>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    if (!this.token) {
      throw new HovercodeError(
        'Missing Hovercode API token. Set HOVERCODE_API_TOKEN or pass { token }. ' +
          'Find it at https://hovercode.com/api/ (API access is on the Business plan, with a free trial).',
        0,
        null,
        undefined,
        'missing_credentials',
      );
    }
    const url = new URL(path, this.baseUrl);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }

    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      let response: Response;
      try {
        response = await this.fetchImpl(url.toString(), {
          method,
          headers: {
            Authorization: `Token ${this.token}`,
            Accept: 'application/json',
            ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          },
          body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
        });
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          throw new HovercodeError(
            `Request timed out after ${this.timeoutMs}ms: ${method} ${url.pathname}`,
            0,
            null,
            undefined,
            'timeout',
          );
        }
        throw err;
      } finally {
        clearTimeout(timer);
      }

      if (response.status === 204) return undefined as T;
      const text = await response.text();
      let body: unknown = text;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        // Non-JSON body (e.g. an inline SVG); return it as text.
      }
      if (response.ok) return body as T;

      const retryAfter = Number(response.headers.get('Retry-After')) || undefined;
      if (response.status === 429 && attempt < this.maxRetries) {
        await sleep((retryAfter ?? 2 ** attempt) * 1000);
        continue;
      }
      throw new HovercodeError(errorMessage(response.status, body), response.status, body, retryAfter);
    }
  }

  /**
   * The workspace to use: the explicit one, else the client's, else the token's current
   * workspace (looked up once via `workspaces.list()` and cached).
   */
  private async workspaceId(workspace?: string): Promise<string> {
    const id = workspace ?? this.workspace;
    if (id) return id;
    this.currentWorkspace ??= this.workspaces.list().then(
      (res) => {
        const current = res.current_workspace ?? res.results[0]?.id;
        if (!current) throw new HovercodeError('This account has no workspaces.', 0, res, undefined, 'missing_credentials');
        return current;
      },
      (err) => {
        this.currentWorkspace = undefined;
        if (err instanceof HovercodeError && err.code === 'missing_credentials') throw err;
        throw new HovercodeError(
          `Couldn't look up your workspace (${err.message}). Set HOVERCODE_WORKSPACE_ID or pass { workspace }: ` +
            'it is shown next to your API token at https://hovercode.com/api/.',
          err instanceof HovercodeError ? err.status : 0,
          err instanceof HovercodeError ? err.body : null,
        );
      },
    );
    return this.currentWorkspace;
  }

  readonly workspaces = {
    /** The workspaces this token can use, oldest first, each with its plan and dynamic-code quota. */
    list: (params: { page?: number; page_size?: number } = {}): Promise<WorkspacePage> =>
      this.request('GET', '/api/v2/workspaces/', { query: params }),
    /** Every workspace, walking the pages for you. */
    listAll: (): AsyncGenerator<Workspace> =>
      this.paginate(Promise.resolve('/api/v2/workspaces/'), { page_size: 200 }),
    /**
     * Create a workspace you own: typically one per customer when building QR codes into
     * your product. Store its `id` against the customer. Fails with 403 at the plan's
     * workspace limit.
     */
    create: (params: { name: string }): Promise<Workspace> =>
      this.request('POST', '/api/v2/workspace/create/', { body: params }),
    /** Rename a workspace (owners and admins). */
    update: (id: string, params: { name: string }): Promise<Workspace> =>
      this.request('PATCH', `/api/v2/workspace/${id}/update/`, { body: params }),
  };

  private async *paginate<T>(path: Promise<string>, query: RequestOptions['query']): AsyncGenerator<T> {
    let page = await this.request<Page<T>>('GET', await path, { query });
    for (;;) {
      yield* page.results;
      if (!page.next) return;
      page = await this.request<Page<T>>('GET', page.next);
    }
  }

  readonly codes = {
    /**
     * Create a QR code. Dynamic codes (`dynamic: true`) encode a tracked short link,
     * so the destination can be changed later without reprinting.
     */
    create: async (params: CreateCodeParams): Promise<QRCodeRecord> => {
      const body = { ...params, workspace: await this.workspaceId(params.workspace) };
      if (!body.qr_type) delete body.qr_type;
      return this.request('POST', '/api/v2/hovercode/create/', { body });
    },
    get: (id: string): Promise<QRCodeRecord> => this.request('GET', `/api/v2/hovercode/${id}/`),
    /** Change the destination (`qr_data`, Link codes), name, GPS tracking or folder. */
    update: (
      id: string,
      params: { qr_data?: string; display_name?: string; gps_tracking?: boolean; folder?: string | null },
    ): Promise<QRCodeRecord> => this.request('PATCH', `/api/v2/hovercode/${id}/update/`, { body: params }),
    /** Restyle in place: the code, destination and scan history don't change. */
    updateDesign: (id: string, design: DesignUpdate): Promise<QRCodeRecord> =>
      this.request('PATCH', `/api/v2/hovercode/${id}/design/`, { body: design }),
    delete: (id: string): Promise<void> => this.request('DELETE', `/api/v2/hovercode/${id}/delete/`),
    list: async (params: ListCodesParams = {}, workspace?: string): Promise<Page<QRCodeRecord>> =>
      this.request('GET', `/api/v2/workspace/${await this.workspaceId(workspace)}/hovercodes/`, {
        query: { ...params, include: params.include?.join(',') },
      }),
    /** Every code in the workspace, walking the pages for you. */
    listAll: (params: Omit<ListCodesParams, 'page'> = {}, workspace?: string): AsyncGenerator<QRCodeRecord> =>
      this.paginate(
        this.workspaceId(workspace).then((id) => `/api/v2/workspace/${id}/hovercodes/`),
        { page_size: 200, ...params, include: params.include?.join(',') },
      ),
    analytics: (id: string, period: PeriodParams = {}): Promise<Analytics> =>
      this.request('GET', `/api/v2/hovercode/${id}/analytics/`, { query: { ...period } }),
    activity: (id: string, params: { page?: number; page_size?: number } = {}): Promise<Page<Scan>> =>
      this.request('GET', `/api/v2/hovercode/${id}/activity/`, { query: params }),
    /** Print-ready `png_url` and `svg_url`. */
    download: (id: string): Promise<{ png_url: string; svg_url: string }> =>
      this.request('GET', `/api/v2/hovercode/${id}/download/`),
    addTags: (id: string, tags: Array<{ title: string } | { id: string }>): Promise<QRCodeRecord> =>
      this.request('POST', `/api/v2/hovercode/${id}/tags/add/`, { body: tags }),
    removeTag: (id: string, tag: string): Promise<QRCodeRecord> =>
      this.request('DELETE', `/api/v2/hovercode/${id}/tag/${tag}/remove/`),
  };

  readonly links = {
    create: async (params: CreateLinkParams) =>
      this.request<Record<string, unknown>>('POST', '/api/v2/link/create/', {
        body: { ...params, workspace: await this.workspaceId(params.workspace) },
      }),
    get: (id: string) => this.request<Record<string, unknown>>('GET', `/api/v2/link/${id}/`),
    update: (id: string, params: { link?: string; display_name?: string; gps?: boolean }) =>
      this.request<Record<string, unknown>>('PATCH', `/api/v2/link/${id}/update/`, { body: params }),
    delete: (id: string): Promise<void> => this.request('DELETE', `/api/v2/link/${id}/delete/`),
    list: async (params: { q?: string; page?: number; page_size?: number } = {}, workspace?: string) =>
      this.request<Page<Record<string, unknown>>>('GET', `/api/v2/workspace/${await this.workspaceId(workspace)}/links/`, {
        query: params,
      }),
    /** The link's QR as an SVG string. */
    qrSvg: (id: string): Promise<string> => this.request('GET', `/api/v2/link/${id}/qr/`, { query: { format: 'svg' } }),
    activity: (id: string, params: { page?: number; page_size?: number } = {}): Promise<Page<Scan>> =>
      this.request('GET', `/api/v2/link/${id}/activity/`, { query: params }),
  };

  readonly pdf = {
    /** Host a PDF behind a dynamic QR code. Pass `pdf_url` or `pdf_base64`. */
    create: async (params: CreatePdfParams) =>
      this.request<QRCodeRecord & { pdf_file_url: string }>('POST', '/api/v2/pdf/create/', {
        body: { ...params, workspace: await this.workspaceId(params.workspace) },
      }),
  };

  readonly pages = {
    /** Create and publish a link-in-bio landing page with its own QR code. */
    create: async (params: CreatePageParams) =>
      this.request<Record<string, unknown> & { id: string; share_url: string; svg: string }>(
        'POST',
        '/api/v2/page/create/',
        { body: { ...params, workspace: await this.workspaceId(params.workspace) } },
      ),
    get: (id: string) => this.request<Record<string, unknown>>('GET', `/api/v2/page/${id}/`),
    list: async (workspace?: string) =>
      this.request<unknown>('GET', `/api/v2/workspace/${await this.workspaceId(workspace)}/pages/`),
  };

  readonly forms = {
    list: async (params: { q?: string; page?: number; page_size?: number } = {}, workspace?: string) =>
      this.request<Page<Record<string, unknown>>>('GET', '/api/v2/forms/', {
        query: { workspace: await this.workspaceId(workspace), ...params },
      }),
    responses: (id: string, params: { page?: number; page_size?: number } = {}) =>
      this.request<Page<Record<string, unknown>>>('GET', `/api/v2/forms/${id}/responses/`, { query: params }),
  };

  readonly folders = {
    list: async (workspace?: string) =>
      this.request<Page<Folder>>('GET', `/api/v2/workspace/${await this.workspaceId(workspace)}/folders/`),
    /** Idempotent: an existing folder with the same name and parent is returned instead of a duplicate. */
    create: async (params: { name: string; parent?: string; workspace?: string }) =>
      this.request<Folder>('POST', '/api/v2/folder/create/', {
        body: { ...params, workspace: await this.workspaceId(params.workspace) },
      }),
    update: (id: string, params: { name?: string; parent?: string | null }) =>
      this.request<Folder>('PATCH', `/api/v2/folder/${id}/update/`, { body: params }),
    delete: (id: string): Promise<void> => this.request('DELETE', `/api/v2/folder/${id}/delete/`),
  };

  readonly templates = {
    list: async (workspace?: string) =>
      this.request<Page<Record<string, unknown>>>(
        'GET',
        `/api/v2/workspace/${await this.workspaceId(workspace)}/templates/`,
      ),
  };

  readonly tags = {
    list: async (workspace?: string) =>
      this.request<Page<Tag> | Tag[]>('GET', `/api/v2/workspace/${await this.workspaceId(workspace)}/tags/`),
  };

  /** Workspace-wide scan totals, plus `top_codes` (`top` up to 100). */
  async analytics(period: PeriodParams & { top?: number } = {}, workspace?: string): Promise<Analytics> {
    return this.request('GET', `/api/v2/workspace/${await this.workspaceId(workspace)}/analytics/`, {
      query: { ...period },
    });
  }
}
