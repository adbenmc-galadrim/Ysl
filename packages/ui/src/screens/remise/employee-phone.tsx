import { Viewfinder } from '#components/camera-viewport';
import { QrCode } from '#components/qr-code';

export type EmployeePhoneProps = {
  code: string;
  qr: string[];
};

/**
 * What the camera sees at the counter: the employee holding up the pickup
 * e-mail on their phone. Only a picture for the story; the viewfinder is
 * sized to the QR, which is all the scanner needs.
 */
export function EmployeePhone({ code, qr }: EmployeePhoneProps) {
  // `-ml-px` puts the 200 px phone on a whole pixel in the 393 px frame,
  // as Penpot does, instead of centring it on a half one.
  return (
    <div className="relative mt-10 -ml-px h-[300px] w-[200px] rounded-[28px] bg-scene-phone p-2">
      <div className="flex h-full flex-col items-center rounded-[22px] bg-white">
        <QrCode matrix={qr} module={10} className="mt-[52px] rounded-none" />
        <span className="mt-[13px] font-mono text-22 font-semibold text-black">
          {code}
        </span>
      </div>
      <Viewfinder className="absolute top-[50px] left-5 size-40" />
    </div>
  );
}
