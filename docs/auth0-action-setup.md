# Auth0 Custom Action — JWT Custom Claims Kurulumu

Bu döküman, Psikoport'un `tenant_id` ve `role` claim'lerini JWT access token'larına eklemek için gereken Auth0 Action kurulumunu açıklar.

## Action Kodu

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const namespace = event.client.client_id;
  api.accessToken.setCustomClaim(`${namespace}/tenant_id`, event.user.app_metadata?.tenant_id);
  api.accessToken.setCustomClaim(`${namespace}/role`, event.user.app_metadata?.role);
};
```

> **Not:** `event.client.client_id` namespace olarak kullanılır. Bu sayede claim anahtarları her uygulama için benzersiz olur ve Auth0'ın OIDC uyumluluk gereksinimleri karşılanır.

## Adım Adım Kurulum

### 1. Action Oluşturma

1. [Auth0 Dashboard](https://manage.auth0.com) → **Actions** → **Library** sayfasına gidin.
2. Sağ üstteki **Build Custom** butonuna tıklayın.
3. Şu değerleri girin:
   - **Name:** `Add Psikoport Claims`
   - **Trigger:** `Login / Post Login`
   - **Runtime:** `Node 18`
4. **Create** butonuna tıklayın.

### 2. Kodu Yapıştırma ve Deploy Etme

1. Açılan kod editörüne yukarıdaki Action kodunu yapıştırın.
2. Sağ üstteki **Deploy** butonuna tıklayın.
3. Action'ın `Deployed` durumuna geçtiğini doğrulayın.

### 3. Login Flow'a Ekleme

1. **Actions** → **Flows** → **Login** sayfasına gidin.
2. Sağ paneldeki **Custom** sekmesinde `Add Psikoport Claims` action'ını bulun.
3. Action'ı akış diyagramında `Start` ile `Complete` arasına sürükleyip bırakın.
4. **Apply** butonuna tıklayarak kaydedin.

## app_metadata Yapısı

Her kullanıcının `app_metadata` alanında şu değerler bulunmalıdır:

```json
{
  "tenant_id": "clx_tenant_abc123",
  "role": "psychologist"
}
```

Geçerli roller: `psychologist`, `assistant`, `admin`

Bu değerler Auth0 Management API veya Admin paneli üzerinden set edilir:

```bash
# Management API ile güncelleme örneği
PATCH https://{domain}/api/v2/users/{user_id}
Authorization: Bearer {management_api_token}
Content-Type: application/json

{
  "app_metadata": {
    "tenant_id": "clx_tenant_abc123",
    "role": "psychologist"
  }
}
```

## API Tarafında Claim Okuma

API, JWT token'ındaki custom claim'leri şu şekilde okur ([jwt.strategy.ts](../apps/api/src/modules/auth/strategies/jwt.strategy.ts)):

```typescript
const tenantId = payload[`${clientId}/tenant_id`];
const role     = payload[`${clientId}/role`];
```

`clientId` değeri `AUTH0_CLIENT_ID` environment değişkeninden gelir.

## 2FA (TOTP) için AMR Claim

Eğer 2FA doğrulama durumu da token'a eklenecekse Action kodunu şu şekilde genişletin:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const namespace = event.client.client_id;
  api.accessToken.setCustomClaim(`${namespace}/tenant_id`, event.user.app_metadata?.tenant_id);
  api.accessToken.setCustomClaim(`${namespace}/role`,      event.user.app_metadata?.role);
  api.accessToken.setCustomClaim(`${namespace}/amr`,       event.authentication?.methods ?? []);
};
```

`amr` array'i içinde `mfa` veya `totp` değeri varsa 2FA tamamlanmış demektir. Bu değer `TwoFactorGuard` tarafından kontrol edilir.
