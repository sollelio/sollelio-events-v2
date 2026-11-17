import type { FormErrorKey } from "@/lib/auth/errors";
import type { FieldErrorKey } from "@/lib/auth/validation";
import type { SignInNotice } from "@/lib/auth/viewer";
import type { OnboardingFormErrorKey } from "@/lib/organizations/onboarding";
import type { OrganizationFieldErrorKey } from "@/lib/organizations/validation";

/** European Portuguese interface copy. */
export const ptPT = {
  common: {
    productName: "Sollelio Events",
    signOut: "Terminar sessão",
    signingOut: "A terminar sessão…",
  },
  appearance: {
    legend: "Aparência",
    light: "Claro",
    dark: "Escuro",
    system: "Sistema",
  },
  auth: {
    fields: {
      email: "Email",
      password: "Palavra-passe",
      newPasswordHint: "Pelo menos 8 caracteres.",
    },
    signIn: {
      metaTitle: "Iniciar sessão",
      title: "Iniciar sessão",
      description: "Aceda à sua conta Sollelio Events.",
      submit: "Entrar",
      pending: "A entrar…",
      noAccount: "Ainda não tem conta?",
      toSignUp: "Criar conta",
    },
    signUp: {
      metaTitle: "Criar conta",
      title: "Criar conta",
      description: "Comece com o seu email e uma palavra-passe.",
      submit: "Criar conta",
      pending: "A criar conta…",
      haveAccount: "Já tem conta?",
      toSignIn: "Iniciar sessão",
    },
    checkEmail: {
      metaTitle: "Confirme o seu email",
      title: "Confirme o seu email",
      body: "Se o endereço puder ser registado, enviámos uma mensagem com uma ligação de confirmação. Abra-a para ativar a sua conta.",
      hint: "Abra a ligação neste dispositivo e navegador para entrar automaticamente. Noutro dispositivo, o email fica confirmado e poderá iniciar sessão a seguir.",
      notReceived:
        "Não recebeu? Verifique a pasta de spam. A ligação expira ao fim de algum tempo.",
      toSignIn: "Voltar a iniciar sessão",
    },
    notices: {
      "signed-out": "Sessão terminada.",
      unverified: "Confirme o seu email antes de continuar.",
      "confirmation-failed":
        "Não foi possível concluir a confirmação neste navegador. Se já confirmou o email, inicie sessão.",
      "link-expired": "A ligação de confirmação é inválida ou expirou.",
    } satisfies Record<SignInNotice, string>,
    fieldErrors: {
      emailRequired: "Indique o seu email.",
      emailInvalid: "Indique um email válido.",
      passwordRequired: "Indique a sua palavra-passe.",
      passwordTooShort: "A palavra-passe deve ter pelo menos 8 caracteres.",
      passwordTooLong: "A palavra-passe é demasiado longa.",
    } satisfies Record<FieldErrorKey, string>,
    formErrors: {
      invalidCredentials: "Email ou palavra-passe incorretos.",
      emailNotConfirmed:
        "Confirme o seu email antes de iniciar sessão. Procure a mensagem que lhe enviámos.",
      weakPassword: "Escolha uma palavra-passe mais forte.",
      emailInvalid: "Este email não pode ser utilizado.",
      rateLimited: "Demasiadas tentativas. Aguarde um pouco e tente novamente.",
      signUpUnavailable: "O registo não está disponível de momento.",
      generic: "Não foi possível concluir o pedido. Tente novamente.",
    } satisfies Record<FormErrorKey, string>,
  },
  onboarding: {
    metaTitle: "Criar organização",
    eyebrow: "Primeiros passos",
    title: "Crie a sua organização",
    description: "Indique o nome e o país da sua empresa.",
    signedInAs: "Sessão iniciada como",
    fields: {
      name: "Nome da organização",
      country: "País",
      countryPlaceholder: "Selecione o país",
      countryHint:
        "O país não define o idioma, o fuso horário nem a moeda, que serão configurados à parte.",
    },
    submit: "Criar organização",
    pending: "A criar organização…",
    fieldErrors: {
      nameRequired: "Indique o nome da organização.",
      nameTooLong: "O nome pode ter no máximo 120 caracteres.",
      nameInvalid: "O nome contém caracteres que não são permitidos.",
      countryRequired: "Selecione o país.",
      countryInvalid: "Selecione um país da lista.",
    } satisfies Record<OrganizationFieldErrorKey, string>,
    formErrors: {
      unavailable:
        "Não foi possível criar a organização. Tente novamente: o pedido não será duplicado.",
      notAllowed:
        "A sua conta não pode criar uma organização. Inicie sessão novamente e confirme o seu email.",
      invalid: "Verifique o nome e o país e tente novamente.",
      requestReused:
        "Este pedido já tinha sido utilizado com outros dados. Verifique os dados e submeta novamente.",
      generic:
        "Não foi possível processar o pedido. Verifique os dados e submeta novamente.",
    } satisfies Record<OnboardingFormErrorKey, string>,
    failure: {
      metaTitle: "Erro",
      title: "Não foi possível continuar",
      body: "Verifique a sua ligação e tente novamente. Se a organização já tiver sido criada, segue diretamente para ela.",
      retry: "Tentar novamente",
    },
  },
  home: {
    metaTitle: "Início",
    eyebrow: "Organização",
    empty: "Ainda não existem pedidos nem eventos nesta organização.",
    signedInAs: "Sessão iniciada como",
  },
} as const;

export type Messages = typeof ptPT;
