export type LogLevel = "INFO" | "WARNING" | "ERROR";

export type LogEntry = {
  id: string;
  time: string;
  level: LogLevel;
  source: string;
  message: string;
};

export const EXECUTION_LOG_ENTRIES: LogEntry[] = [
  {
    id: "log-01",
    time: "14:31:02",
    level: "INFO",
    source: "APOLLO_SYNC",
    message: "Target list 'UK_Logistics_Q2' fetched: 412 leads.",
  },
  {
    id: "log-02",
    time: "14:32:15",
    level: "INFO",
    source: "SCRAPER_ENGINE",
    message: "Vertex Systems /about parsed successfully. Extracted 2 ICP triggers.",
  },
  {
    id: "log-03",
    time: "14:32:18",
    level: "WARNING",
    source: "FIRE_CRAWL",
    message: "Rate limit approaching on API key... pausing for 2000ms.",
  },
  {
    id: "log-04",
    time: "14:32:21",
    level: "INFO",
    source: "EMAIL_ARCHITECT",
    message: "Draft generated for John Doe (COO). Tokens: 142.",
  },
  {
    id: "log-05",
    time: "14:32:25",
    level: "INFO",
    source: "INSTANTLY_PIPE",
    message: "Payload dispatched to tryhaltonworks.com server.",
  },
  {
    id: "log-06",
    time: "14:33:04",
    level: "INFO",
    source: "CONTEXT_CONDENSER",
    message: "Northline Analytics scrape condensed to 480 tokens.",
  },
  {
    id: "log-07",
    time: "14:34:11",
    level: "WARNING",
    source: "ENRICHMENT_QUEUE",
    message: "HarborGrid Logistics email status flagged RISKY — holding for triage.",
  },
  {
    id: "log-08",
    time: "14:35:27",
    level: "ERROR",
    source: "SMTP_FAIL",
    message: "Delivery bounced for target domain. Flagging for review.",
  },
];

export type LogFilter = "ALL" | LogLevel;

export const LOG_FILTERS: LogFilter[] = ["ALL", "INFO", "WARNING", "ERROR"];
