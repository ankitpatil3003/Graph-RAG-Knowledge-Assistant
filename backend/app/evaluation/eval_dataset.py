"""Ground-truth evaluation dataset from the 3 ingested financial PDFs."""

# Each entry: question, ground_truth answer, relevant context keywords
EVAL_DATASET = [
    # --- Fund Performance Summary (Horizon Fund II) ---
    {
        "question": "What was Horizon Fund II's 2025 annualized return?",
        "ground_truth": "8.2% net to investors.",
        "context_keywords": ["horizon", "return", "8.2"],
    },
    {
        "question": "How many assets does Horizon Fund II hold and what is the total AUM?",
        "ground_truth": "11 assets with combined AUM of $485M.",
        "context_keywords": ["horizon", "assets", "485"],
    },
    {
        "question": "What was the year-over-year change in Horizon Fund II's portfolio NOI?",
        "ground_truth": "Portfolio NOI increased from $21.4M in 2024 to $23.1M in 2025, a 7.9% YoY increase.",
        "context_keywords": ["NOI", "21.4", "23.1", "7.9"],
    },
    {
        "question": "What is Horizon Fund II's equity multiple since inception?",
        "ground_truth": "1.34x.",
        "context_keywords": ["equity", "multiple", "1.34"],
    },
    {
        "question": "What was the average rent growth in secondary markets for Horizon Fund II?",
        "ground_truth": "Rent growth in secondary markets such as Raleigh and Phoenix averaged 4.6%.",
        "context_keywords": ["rent", "growth", "4.6", "raleigh", "phoenix"],
    },
    # --- Q4 2025 Investor Update (Alpha Capital Fund I) ---
    {
        "question": "What was Alpha Capital Fund I's NOI in Q4 2025?",
        "ground_truth": "$3.4M (specifically $3,402,500), representing a 7.2% YoY increase.",
        "context_keywords": ["alpha", "NOI", "3.4", "7.2"],
    },
    {
        "question": "At what rate was the Parkview asset refinanced?",
        "ground_truth": "The Parkview Multifamily Asset was refinanced at a fixed rate of 5.15%, extending loan maturity by 7 years and releasing $1.2M in excess proceeds.",
        "context_keywords": ["parkview", "5.15", "refinanc"],
    },
    {
        "question": "What is Alpha Capital Fund I's Q4 2025 gross revenue?",
        "ground_truth": "$9,821,000, up 7.1% YoY and 1.7% QoQ.",
        "context_keywords": ["revenue", "9,821", "7.1"],
    },
    {
        "question": "What is the targeted annual yield for Alpha Capital Fund I?",
        "ground_truth": "6.5-7.0%.",
        "context_keywords": ["yield", "6.5", "7.0"],
    },
    {
        "question": "What happened with the Ridgegate Industrial asset?",
        "ground_truth": "Tenant renewal was secured through 2031 at 4.2% escalations.",
        "context_keywords": ["ridgegate", "2031", "4.2"],
    },
    # --- Asset Summary Report (Meridian Logistics) ---
    {
        "question": "What is the total square footage of the Meridian Logistics portfolio?",
        "ground_truth": "1.2M SF across 6 industrial assets in the Midwest.",
        "context_keywords": ["meridian", "1.2M", "SF"],
    },
    {
        "question": "What is the occupancy rate of the Indy South asset?",
        "ground_truth": "100%, fully leased through 2030.",
        "context_keywords": ["indy", "100", "2030"],
    },
    {
        "question": "Which asset has the lowest DSCR in the Meridian portfolio?",
        "ground_truth": "Cincinnati North with a DSCR of 1.29x.",
        "context_keywords": ["cincinnati", "1.29"],
    },
    {
        "question": "What is the weighted average lease term for the Meridian portfolio?",
        "ground_truth": "5.8 years.",
        "context_keywords": ["WALT", "5.8"],
    },
    # --- Cross-document questions (multi-hop) ---
    {
        "question": "Compare the occupancy rates of Horizon Fund II and the Meridian Logistics portfolio.",
        "ground_truth": "Horizon Fund II has an average occupancy of 94.8% (2025), while Meridian Logistics achieved 97% occupancy as of December 31, 2025.",
        "context_keywords": ["occupancy", "94.8", "97"],
    },
]
