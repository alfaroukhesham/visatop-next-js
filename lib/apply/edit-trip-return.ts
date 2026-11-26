export interface IEditTripReturnInput {
  applicationId: string;
  fromPayment: boolean;
  locked: boolean;
  extrasOffered: boolean;
}

export interface IEditTripReturnHrefs {
  backHref: string;
  previousHref: string | null;
}

/** Back returns to Pay when the trip was opened from Pay. Previous uses the step before that. */
export const editTripReturnHrefs = ({
  applicationId,
  fromPayment,
  locked,
  extrasOffered,
}: IEditTripReturnInput): IEditTripReturnHrefs => {
  const id = encodeURIComponent(applicationId);
  const payment = `/apply/applications/${id}/payment`;
  const extras = `/apply/applications/${id}/extras`;
  const application = `/apply/applications/${id}`;
  const backHref = fromPayment || locked ? payment : extrasOffered ? extras : application;
  const previousHref =
    backHref === payment ? (extrasOffered ? extras : application) : backHref === extras ? application : null;
  return { backHref, previousHref: previousHref === backHref ? null : previousHref };
};
