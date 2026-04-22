export class SalesCallWorkflowService {
    extractDealFields(transcript = '') {
        const text = transcript.replace(/\s+/g, ' ').trim();

        const customer = this.matchFirst(text, [
            /(?:speaking with|talked to|met with)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/i,
            /(?:customer|prospect|buyer)\s*[:\-]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/i
        ]);

        const company = this.matchFirst(text, [
            /(?:from|at)\s+([A-Z][\w&.-]+(?:\s+[A-Z][\w&.-]+){0,3})/,
            /(?:company|account|organization)\s*[:\-]\s*([A-Z][\w&.-]+(?:\s+[A-Z][\w&.-]+){0,3})/i
        ]);

        const valueRaw = this.matchFirst(text, [
            /(\$\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?)/,
            /(\d{1,3}(?:,\d{3})+)\s*(?:usd|dollars)/i
        ]);

        const timeline = this.matchFirst(text, [
            /(?:go live|launch|start|decision)\s+(?:by|in)\s+([^.,;]{3,60})/i,
            /(?:timeline|target date|deadline)\s*[:\-]\s*([^.,;]{3,60})/i
        ]);

        const painPoints = this.extractBullets(text, [
            'manual', 'slow', 'churn', 'integration', 'handoff', 'reporting', 'visibility', 'follow-up', 'pipeline'
        ]);

        const nextSteps = this.extractBullets(text, [
            'send proposal', 'book demo', 'share pricing', 'security review', 'legal review', 'follow up', 'pilot', 'next call'
        ]);

        const stage = /proposal|pricing|quote/i.test(text)
            ? 'Proposal'
            : /pilot|poc|trial/i.test(text)
                ? 'Pilot'
                : /decision|procurement|legal/i.test(text)
                    ? 'Negotiation'
                    : 'Discovery';

        return {
            lead_name: customer || 'Unknown Prospect',
            account_name: company || 'Unknown Account',
            stage,
            opportunity_value: valueRaw || null,
            timeline: timeline || null,
            pain_points: painPoints,
            next_steps: nextSteps,
            summary: this.buildSummary({ customer, company, stage, valueRaw, timeline, painPoints, nextSteps })
        };
    }

    buildCrmPayload(extracted, transcript) {
        return {
            crm: 'demo-crm',
            object: 'deal_update',
            generated_at: new Date().toISOString(),
            fields: {
                leadName: extracted.lead_name,
                accountName: extracted.account_name,
                stage: extracted.stage,
                dealValue: extracted.opportunity_value,
                timeline: extracted.timeline,
                painPoints: extracted.pain_points,
                nextSteps: extracted.next_steps
            },
            notes: extracted.summary,
            transcript_excerpt: transcript.slice(0, 1200)
        };
    }

    matchFirst(text, regexes) {
        for (const regex of regexes) {
            const match = text.match(regex);
            if (match?.[1]) {
                return match[1].trim();
            }
        }
        return null;
    }

    extractBullets(text, keywords) {
        const normalized = text.toLowerCase();
        const hits = keywords
            .filter((keyword) => normalized.includes(keyword.toLowerCase()))
            .slice(0, 5);

        return hits.map((hit) => this.toSentence(hit));
    }

    toSentence(value) {
        return value.charAt(0).toUpperCase() + value.slice(1);
    }

    buildSummary(data) {
        const parts = [];

        if (data.customer || data.company) {
            parts.push(`Call with ${data.customer || 'prospect'} at ${data.company || 'target account'}.`);
        }
        if (data.valueRaw) {
            parts.push(`Potential deal size discussed: ${data.valueRaw}.`);
        }
        parts.push(`Current stage assessed as ${data.stage}.`);
        if (data.timeline) {
            parts.push(`Target timeline: ${data.timeline}.`);
        }
        if (data.painPoints?.length) {
            parts.push(`Pain points: ${data.painPoints.join(', ')}.`);
        }
        if (data.nextSteps?.length) {
            parts.push(`Next steps: ${data.nextSteps.join(', ')}.`);
        }

        return parts.join(' ');
    }
}

export default SalesCallWorkflowService;
