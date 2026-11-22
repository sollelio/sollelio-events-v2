import type { FormErrorKey } from "@/lib/auth/errors";
import type { FieldErrorKey } from "@/lib/auth/validation";
import type { SignInNotice } from "@/lib/auth/viewer";
import type {
  CloseReason,
  InquiryFieldErrorKey,
  InquiryFormErrorKey,
  InquirySource,
  InquiryStatus,
} from "@/lib/inquiries/inquiry";
import type { OnboardingFormErrorKey } from "@/lib/organizations/onboarding";
import type {
  AnswerErrorKey,
  PublicFormErrorKey,
} from "@/lib/public-forms/form";
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
  shell: {
    skipToContent: "Saltar para o conteúdo",
    primaryNavigation: "Navegação principal",
    nav: {
      home: "Home",
      inquiries: "Pedidos",
      events: "Eventos",
      contacts: "Contactos",
      settings: "Definições",
    },
    comingSoon: "Em breve",
    organization: "Organização",
    switchOrganization: "Mudar de organização",
    account: "Conta e preferências",
    signedInAs: "Sessão iniciada como",
  },
  home: {
    metaTitle: "Home",
    title: "Home",
    description: "O que precisa da sua atenção e o próximo passo.",
    nextAction: {
      eyebrow: "Próxima ação",
      title: "Registe o primeiro pedido",
      body: "Quando um cliente entrar em contacto, registe o pedido para guardar a mensagem original e acompanhar o caminho até ao evento confirmado.",
      action: "Registar primeiro pedido",
      register: "Registar pedido",
      viewAll: "Ver pedidos",
      titleOngoing: "Registe cada novo pedido",
      bodyOngoing:
        "Guarde a mensagem original de cada cliente assim que o pedido chega.",
    },
    journey: {
      title: "Como funciona",
      steps: [
        {
          title: "Pedido",
          body: "Guarde o contacto e a mensagem original do cliente.",
        },
        {
          title: "Evento e proposta",
          body: "Crie o evento e envie uma proposta com versões.",
        },
        {
          title: "Confirmação",
          body: "Registe os pagamentos e confirme o evento quando estiver pronto.",
        },
      ],
    },
    attention: {
      title: "Atenção",
      openInquiries: "{count} pedidos em aberto",
      openInquiry: "1 pedido em aberto",
      empty: "Nada requer a sua atenção.",
      hint: "Novos pedidos, decisões de clientes e prazos próximos aparecem aqui.",
    },
  },
  inquiries: {
    metaTitle: "Pedidos",
    title: "Pedidos",
    description:
      "Pedidos recebidos de clientes, com a mensagem original preservada.",
    register: "Registar pedido",
    registerFirst: "Registar primeiro pedido",
    sources: {
      phone: "Telefone",
      whatsapp: "WhatsApp",
      email: "Email",
      social_media: "Redes sociais",
      in_person: "Presencial",
      website: "Website",
      referral: "Recomendação",
      other: "Outro",
    } satisfies Record<InquirySource, string>,
    statuses: {
      open: "Em aberto",
      closed: "Fechado",
    } satisfies Record<InquiryStatus, string>,
    closeReasons: {
      spam: "Spam",
      duplicate: "Duplicado",
      not_pursued: "Não avançou",
      registered_in_error: "Registado por engano",
    } satisfies Record<CloseReason, string>,
    list: {
      tabsLabel: "Estado dos pedidos",
      openTab: "Em aberto",
      closedTab: "Fechados",
      noName: "Sem nome",
      summaryPrefix: "Resumo:",
      guests: "convidados",
      emptyFirstTitle: "Ainda não há pedidos",
      emptyFirstBody:
        "Registe aqui cada pedido de cliente, com a mensagem original ou um resumo do que foi pedido.",
      emptyOpen: "Não há pedidos em aberto.",
      emptyClosed: "Não há pedidos fechados.",
      truncated: "A mostrar os {shown} mais recentes de {total}.",
    },
    form: {
      metaTitle: "Registar pedido",
      title: "Registar pedido",
      description:
        "Guarde o pedido como chegou. Pode ficar incompleto: não invente o que o cliente não disse.",
      back: "Pedidos",
      source: "Origem",
      request: "Pedido",
      requestHint:
        "Preencha pelo menos um: a mensagem do cliente, tal como a recebeu, ou um resumo escrito pela equipa.",
      clientMessage: "Mensagem do cliente",
      clientMessageHint:
        "Cole ou transcreva as palavras do cliente, sem alterar.",
      staffSummary: "Resumo da equipa",
      staffSummaryHint:
        "Para pedidos por telefone, presenciais ou sem mensagem escrita.",
      received: "Recebido",
      receivedNow: "Agora",
      receivedOther: "Outra data e hora",
      receivedLocal: "Data e hora de receção",
      receivedLocalHint: "Na hora deste dispositivo.",
      requester: "Quem contactou",
      requesterHint: "Opcional. Tal como indicado pelo cliente.",
      requesterName: "Nome",
      requesterPhone: "Telefone",
      requesterEmail: "Email",
      event: "Evento",
      eventHint: "Opcional. Só o que o cliente indicou.",
      eventDate: "Data pretendida",
      guests: "N.º de convidados (estimativa)",
      optional: "Opcional",
      submit: "Registar pedido",
      pending: "A registar…",
    },
    fieldErrors: {
      sourceRequired: "Escolha a origem do pedido.",
      descriptionRequired:
        "Escreva a mensagem do cliente ou um resumo da equipa.",
      clientMessageTooLong: "A mensagem pode ter no máximo 10 000 caracteres.",
      staffSummaryTooLong: "O resumo pode ter no máximo 5000 caracteres.",
      receivedRequired: "Indique a data e a hora de receção.",
      receivedInvalid: "Indique uma data e hora válidas.",
      receivedInFuture: "A data de receção não pode ser no futuro.",
      receivedTimeZoneMissing:
        "Não foi possível obter o fuso horário deste dispositivo. Escolha «Agora» ou ative o JavaScript.",
      nameTooLong: "O nome pode ter no máximo 200 caracteres.",
      phoneInvalid:
        "Indique um telefone com algarismos (máximo 40 caracteres).",
      emailInvalid: "Indique um email válido.",
      eventDateInvalid: "Indique uma data válida.",
      guestsInvalid: "Indique um número inteiro entre 1 e 100 000.",
    } satisfies Record<InquiryFieldErrorKey, string>,
    formErrors: {
      unavailable:
        "Não foi possível guardar. Tente novamente: o pedido não será duplicado.",
      notAllowed:
        "A sua conta não pode trabalhar com pedidos nesta organização.",
      invalid: "Verifique os dados e tente novamente.",
      requestReused:
        "Este envio já tinha sido usado com outros dados. Verifique e submeta novamente.",
      generic:
        "Não foi possível processar o pedido. Verifique os dados e submeta novamente.",
    } satisfies Record<InquiryFormErrorKey, string>,
    detail: {
      back: "Pedidos",
      eyebrow: "Pedido",
      noName: "Pedido sem nome",
      receivedAt: "Recebido",
      registeredAt: "Registado",
      byYou: "por si",
      clientMessage: "Mensagem do cliente",
      clientMessageNote: "Texto original, tal como recebido.",
      staffSummary: "Resumo da equipa",
      staffSummaryNote: "Escrito pela equipa; não são palavras do cliente.",
      requester: "Contacto indicado",
      requesterNone: "O cliente não indicou contactos.",
      event: "Evento indicado",
      eventDate: "Data pretendida",
      guests: "Convidados (estimativa)",
      eventNone: "Sem data nem número de convidados indicados.",
      status: "Estado",
      closedOn: "Fechado",
      reason: "Motivo",
      closeTitle: "Fechar pedido",
      closeReason: "Motivo",
      closeReasonPlaceholder: "Selecione o motivo",
      closeHint:
        "Fechar um pedido não cancela nenhum evento. Pode reabri-lo mais tarde.",
      close: "Fechar pedido",
      closing: "A fechar…",
      reopen: "Reabrir pedido",
      reopening: "A reabrir…",
      notices: {
        registered: "Pedido registado.",
        closed: "Pedido fechado.",
        reopened: "Pedido reaberto.",
      },
    },
    channels: {
      staff_entry: "Registo manual",
      public_form: "Formulário público",
    },
    sourceNotStated: "Origem não indicada",
    viaPublicForm: "via formulário público",
    formAnswers: {
      title: "Respostas do formulário",
      note: "Perguntas adicionais, tal como foram feitas (versão {version}).",
    },
    publicFormCard: {
      title: "Formulário público",
      offBody:
        "Partilhe um link para que os clientes enviem pedidos sem iniciar sessão. Os pedidos chegam aqui, com as palavras do cliente.",
      enable: "Ativar formulário público",
      enabling: "A ativar…",
      onBody: "Partilhe este link com clientes. Cada envio cria um pedido.",
      linkLabel: "Link do formulário",
      copy: "Copiar link",
      copied: "Copiado",
      open: "Abrir",
      rotate: "Gerar novo link",
      rotateHint: "O link atual deixa de funcionar.",
      revoke: "Desativar",
      revokeHint: "Ninguém poderá enviar pedidos até o ativar de novo.",
      working: "A processar…",
      errors: {
        notAllowed:
          "A sua conta não pode gerir o formulário desta organização.",
        unavailable: "Não foi possível concluir. Tente novamente.",
      },
    },
    noAccess: {
      title: "Sem acesso aos pedidos",
      body: "Os pedidos estão disponíveis para proprietários e gestores da organização.",
    },
  },
  publicForm: {
    required: "obrigatório",
    optional: "opcional",
    submit: "Enviar pedido",
    pending: "A enviar…",
    privacy:
      "Os seus dados são usados por {organization} apenas para responder a este pedido. O formulário é disponibilizado pela Sollelio Events.",
    poweredBy: "Formulário seguro · Sollelio Events",
    answerErrors: {
      required: "Responda a esta pergunta.",
      contactRequired: "Indique um email ou um telefone.",
      email: "Indique um email válido.",
      phone: "Indique um telefone com algarismos.",
      number: "Indique um número.",
      wholeNumber: "Indique um número inteiro entre 1 e 100 000.",
      date: "Indique uma data válida.",
      choice: "Escolha uma das opções.",
      singleLine: "Use apenas uma linha.",
      tooLong: "A resposta é demasiado longa.",
    } satisfies Record<AnswerErrorKey, string>,
    formErrors: {
      unavailable:
        "Não foi possível enviar o pedido. Tente novamente dentro de momentos.",
      versionChanged:
        "O formulário foi atualizado entretanto. Recarregue a página e envie de novo.",
      rateLimited:
        "O pedido não foi enviado: este formulário recebeu demasiados envios num curto período. As suas respostas foram mantidas; tente novamente mais tarde.",
      invalid: "Verifique as respostas e tente novamente.",
      expired:
        "Por segurança, confirme o envio: carregue novamente em Enviar. As suas respostas foram mantidas.",
      confirm:
        "O pedido ainda não foi enviado. Confirme as suas respostas e carregue novamente em Enviar.",
    } satisfies Record<PublicFormErrorKey, string>,
    sent: {
      metaTitle: "Pedido enviado",
      title: "Pedido enviado",
      body: "Obrigado. {organization} recebeu o seu pedido e vai entrar em contacto.",
      bodyGeneric: "Obrigado. O seu pedido foi recebido.",
    },
    unavailable: {
      metaTitle: "Formulário indisponível",
      title: "Formulário indisponível",
      body: "Este link não está ativo. Peça um link atualizado a quem o partilhou.",
    },
  },
  accessSuspended: {
    metaTitle: "Acesso suspenso",
    title: "Acesso suspenso",
    body: "O acesso da sua conta à organização está suspenso. Para o restabelecer, contacte um responsável da organização.",
    hint: "Enquanto a suspensão se mantiver, não é possível ver nem alterar os dados da organização.",
    signedInAs: "Sessão iniciada como",
  },
  selectOrganization: {
    metaTitle: "Escolher organização",
    title: "Escolha a organização",
    description:
      "A sua conta pertence a várias organizações. Escolha aquela em que quer trabalhar.",
    current: "Atual",
    signedInAs: "Sessão iniciada como",
  },
} as const;

export type Messages = typeof ptPT;
