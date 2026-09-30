import { errorResponse, isRecord, json, optionsResponse, parseJson } from '../_shared/http.ts';
import { optionalEnv, requireEnv } from '../_shared/env.ts';
import { createAdminClient, AuthenticationError, requireUser } from '../_shared/supabase.ts';

function textField(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeComponents(value: unknown): Array<Record<string, unknown>> {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 10) {
    throw new Error('components must be an array with at most 10 entries');
  }
  return value.map((component) => {
    if (!isRecord(component) || typeof component.type !== 'string') {
      throw new Error('Each component must contain a type');
    }
    const normalized: Record<string, unknown> = { type: component.type };
    if (typeof component.sub_type === 'string') normalized.sub_type = component.sub_type;
    if (typeof component.index === 'string' || typeof component.index === 'number') {
      normalized.index = component.index;
    }
    if (component.parameters !== undefined) {
      if (!Array.isArray(component.parameters) || component.parameters.length > 20) {
        throw new Error('A WhatsApp component may contain at most 20 parameters');
      }
      normalized.parameters = component.parameters;
    }
    return normalized;
  });
}

function validE164(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return optionsResponse();
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let auth: Awaited<ReturnType<typeof requireUser>>;
  try {
    auth = await requireUser(request);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return json({ error: error.message }, error.status);
    }
    return errorResponse(error);
  }

  try {
    const body = await parseJson(request);
    if (!isRecord(body)) return json({ error: 'Invalid request body' }, 400);

    const profileId = textField(body, 'profileId') || auth.user.id;
    const templateName = textField(body, 'templateName');
    const requestedLanguage = textField(body, 'languageCode');
    if (!templateName) return json({ error: 'templateName is required' }, 400);

    // A customer may send only to their own verified profile. Sending to a
    // different profile requires the database-backed notifications.send
    // permission; no role or permission field is accepted from the client.
    if (profileId !== auth.user.id) {
      const { data: canSend, error: permissionError } = await auth.client.rpc(
        'has_permission',
        { _permission_code: 'notifications.send' },
      );
      if (permissionError || canSend !== true) {
        return json({ error: 'Not authorized to send to this profile' }, 403);
      }
    }

    // TODO(production): validate component count/types against the selected
    // template's variables JSON and require an approved order/event context;
    // also add per-user/per-recipient rate limiting before calling Meta.
    const components = normalizeComponents(body.components);
    const admin = createAdminClient();
    const [{ data: profile, error: profileError }, { data: template, error: templateError }] =
      await Promise.all([
        admin.from('profiles').select('id, phone').eq('id', profileId).maybeSingle(),
        admin.from('whatsapp_templates')
          .select('id, name, provider_template_name, language_code, body, is_active')
          .eq('name', templateName)
          .eq('is_active', true)
          .maybeSingle(),
      ]);

    if (profileError || !profile || !profile.phone) {
      return json({ error: 'Recipient profile or phone number not found' }, 404);
    }
    if (templateError || !template) {
      return json({ error: 'WhatsApp template not found or inactive' }, 404);
    }
    if (!validE164(profile.phone)) {
      return json({ error: 'Recipient phone must be in E.164 format' }, 422);
    }

    const accessToken = requireEnv('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = requireEnv('WHATSAPP_PHONE_NUMBER_ID');
    const apiVersion = optionalEnv('WHATSAPP_API_VERSION', 'v22.0');
    const response = await fetch(
      `https://graph.facebook.com/${encodeURIComponent(apiVersion)}/${encodeURIComponent(phoneNumberId)}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: profile.phone,
          type: 'template',
          template: {
            name: template.provider_template_name,
            language: { code: requestedLanguage || template.language_code },
            components,
          },
        }),
      },
    );
    const providerPayload = await response.json().catch(() => null) as unknown;
    if (!response.ok) {
      // Provider payloads are intentionally not returned: they can echo
      // recipient data or reveal implementation details.
      console.error(`WhatsApp provider returned HTTP ${response.status}`);
      return json({ error: 'WhatsApp provider rejected the message' }, 502);
    }

    const messageId = isRecord(providerPayload) && Array.isArray(providerPayload.messages)
      && isRecord(providerPayload.messages[0])
      ? providerPayload.messages[0].id
      : null;
    if (typeof messageId !== 'string' || !messageId) {
      console.error('WhatsApp provider response did not contain a message id');
      return json({ error: 'WhatsApp provider returned an invalid response' }, 502);
    }

    const { data: notification, error: notificationError } = await admin
      .from('notifications')
      .insert({
        profile_id: profile.id,
        channel: 'whatsapp',
        notification_type: template.name,
        title: template.name,
        body: template.body,
        status: 'sent',
        data: {
          provider: 'whatsapp_cloud_api',
          provider_message_id: messageId,
          language_code: requestedLanguage || template.language_code,
        },
        sent_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (notificationError) {
      // The message was accepted. Return the provider id so a retry does not
      // accidentally send a duplicate; operators can reconcile the notification.
      console.error('WhatsApp message sent but notification record was not saved');
    }

    return json({
      sent: true,
      providerMessageId: messageId,
      notificationId: notification?.id || null,
    });
  } catch (error) {
    if (error instanceof Error && (
      error.message === 'Request body must be valid JSON' ||
      error.message.startsWith('components must') ||
      error.message.startsWith('Each component') ||
      error.message.startsWith('A WhatsApp component')
    )) {
      return json({ error: error.message }, 400);
    }
    console.error('whatsapp-send failed');
    return errorResponse(error);
  }
});
