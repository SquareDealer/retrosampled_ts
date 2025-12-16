import UserComponent from "./UserComponent";
import UserSamplesSection from "./UserSamplesSection";

function UserPage() {
  return (
    <>
      <div className="user-page-container">
        <UserComponent />
        <UserSamplesSection userId={1} />
      </div>
    </>
  )
}

export default UserPage;